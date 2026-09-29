import { Howl, Howler } from 'howler';
import { env, render, sine, sweep, toWavUrl } from './synth';

export type SfxName =
  | 'click'
  | 'sheet'
  | 'error'
  // Crash
  | 'bet'
  | 'tick'
  | 'launch'
  | 'cashout'
  | 'crash'
  // Binary
  | 'buy'
  | 'win'
  | 'loss'
  | 'tie'
  | 'beep';

const MUTE_KEY = 'zunrel:muted';

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
  const chime = (freqs: number[], gap: number, decay: number, vol: number) => (t: number) => {
    let s = 0;
    freqs.forEach((f, i) => {
      const t0 = i * gap;
      if (t > t0) s += sine(f, t - t0) * env(t - t0, 0.003, decay);
    });
    return s * vol;
  };
  return {
    click: render(0.05, (t) => sine(1400, t) * env(t, 0.002, 0.012) * 0.35),
    sheet: render(0.18, (t) => sweep(300, 700, 0.18, t) * env(t, 0.01, 0.05) * 0.18),
    error: render(0.18, (t) => Math.sign(sine(150, t)) * env(t, 0.004, 0.06) * 0.18),
    bet: render(0.22, (t) => (t < 0.09 ? sine(660, t) : sine(990, t)) * env(t % 0.09, 0.004, 0.05) * 0.4),
    tick: render(0.08, (t) => sine(1760, t) * env(t, 0.002, 0.02) * 0.3),
    launch: render(0.35, (t) => sweep(220, 880, 0.35, t) * env(t, 0.02, 0.12) * 0.3),
    cashout: render(0.6, chime([1318.5, 1975.5], 0.08, 0.2, 0.3)),
    crash: render(0.9, (t) => {
      low += (n() - low) * 0.08;
      return (low * 2.2 * env(t, 0.005, 0.18) + sweep(140, 35, 0.9, t) * env(t, 0.005, 0.3)) * 0.55;
    }),
    buy: render(0.3, chime([880, 1320], 0.07, 0.08, 0.32)),
    win: render(0.8, chime([1046.5, 1318.5, 1568], 0.09, 0.2, 0.25)),
    loss: render(0.5, (t) => sweep(330, 140, 0.5, t) * env(t, 0.005, 0.18) * 0.35),
    tie: render(0.25, (t) => sine(660, t) * env(t, 0.004, 0.08) * 0.3),
    beep: render(0.07, (t) => sine(1760, t) * env(t, 0.002, 0.02) * 0.25),
    // 1 s com número inteiro de ciclos → loop sem cliques.
    engine: render(1, (t) => (sine(110, t) * 0.6 + sine(220, t) * 0.3 + sine(330, t) * 0.1) * (0.8 + 0.2 * sine(6, t)) * 0.5),
  };
}

/** Gestão de som do site com Howler.js: efeitos sintetizados, motor do Crash e mute global. */
class SoundManager {
  muted = false;
  onMuteChange: ((muted: boolean) => void) | null = null;
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

  setEngineMultiplier(m: number): void {
    if (this.engine && this.engineId !== null) this.engine.rate(Math.min(2.6, 0.8 + Math.log(m) * 0.55), this.engineId);
  }

  stopEngine(): void {
    if (this.engine && this.engineId !== null) this.engine.stop(this.engineId);
    this.engineId = null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    Howler.mute(muted || document.hidden);
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* ignorar */
    }
    this.onMuteChange?.(muted);
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }
}

export const sound = new SoundManager();
