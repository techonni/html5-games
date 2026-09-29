import { Howl, Howler } from 'howler';
import { env, render, sine, sweep, toWavUrl } from './synth';

export type SfxName = 'click' | 'sheet' | 'buy' | 'win' | 'loss' | 'tie' | 'beep' | 'error';

const MUTE_KEY = 'zunrel-binary:muted';

function build(): Record<SfxName, Float32Array> {
  return {
    click: render(0.05, (t) => sine(1400, t) * env(t, 0.002, 0.012) * 0.35),
    sheet: render(0.18, (t) => sweep(300, 700, 0.18, t) * env(t, 0.01, 0.05) * 0.18),
    buy: render(0.3, (t) => {
      const a = sine(880, t) * env(t, 0.003, 0.06);
      const b = t > 0.07 ? sine(1320, t - 0.07) * env(t - 0.07, 0.003, 0.09) : 0;
      return (a + b) * 0.32;
    }),
    win: render(0.8, (t) => {
      const notes = [1046.5, 1318.5, 1568];
      let s = 0;
      notes.forEach((f, i) => {
        const t0 = i * 0.09;
        if (t > t0) s += sine(f, t - t0) * env(t - t0, 0.003, 0.2);
      });
      return s * 0.25;
    }),
    loss: render(0.5, (t) => sweep(330, 140, 0.5, t) * env(t, 0.005, 0.18) * 0.35),
    tie: render(0.25, (t) => sine(660, t) * env(t, 0.004, 0.08) * 0.3),
    beep: render(0.07, (t) => sine(1760, t) * env(t, 0.002, 0.02) * 0.25),
    error: render(0.18, (t) => Math.sign(sine(150, t)) * env(t, 0.004, 0.06) * 0.18),
  };
}

/** Gestão de som com Howler.js: efeitos sintetizados e mute guardado no browser. */
class SoundManager {
  muted = false;
  private sfx: Partial<Record<SfxName, Howl>> = {};

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
    for (const name of Object.keys(data) as SfxName[]) {
      this.sfx[name] = new Howl({ src: [toWavUrl(data[name])], format: ['wav'] });
    }
  }

  play(name: SfxName, volume = 1): void {
    const h = this.sfx[name];
    if (!h) return;
    const id = h.play();
    h.volume(volume, id);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    Howler.mute(muted || document.hidden);
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* ignorar */
    }
  }
}

export const sound = new SoundManager();
