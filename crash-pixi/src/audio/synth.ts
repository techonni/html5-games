// Sons sintetizados em código e codificados como WAV (sem ficheiros áudio no repo).
const RATE = 44100;

export type Voice = (t: number, i: number) => number;

/** Gera `seconds` de áudio mono a partir de uma função amostra-a-amostra. */
export function render(seconds: number, voice: Voice): Float32Array {
  const n = Math.floor(seconds * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = voice(i / RATE, i);
  return out;
}

/** Envolvente simples: ataque linear e decaimento exponencial. */
export const env = (t: number, attack: number, decay: number): number =>
  t < attack ? t / attack : Math.exp(-(t - attack) / decay);

export const sine = (freq: number, t: number): number => Math.sin(2 * Math.PI * freq * t);

/** Seno com frequência a variar linearmente de f0 para f1 durante `dur` (fase integrada). */
export const sweep = (f0: number, f1: number, dur: number, t: number): number =>
  Math.sin(2 * Math.PI * (f0 * t + ((f1 - f0) * t * t) / (2 * dur)));

/** Codifica PCM 16-bit mono num URL blob que o Howler consegue tocar. */
export function toWavUrl(samples: Float32Array): string {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
