import type { AudioEngine } from './AudioEngine';

/**
 * Blown engine one-shot (procedural, ~0.9 s): a sharp mechanical crack (broadband burst with a
 * fast decay), a low knock of the crank losing a cylinder and a short metallic rattle that fades
 * out. The engine voice itself falls away on its own (no combustion, the crank coasts down), so
 * this only adds the moment of the failure. Deterministic noise (LCG), no external file.
 */
export function renderBlownEngine(sampleRate: number): Float32Array<ArrayBuffer> {
  const n = Math.round(sampleRate * 0.9);
  const out = new Float32Array(new ArrayBuffer(n * 4));
  let seed = 0x2f6b4a1d;
  const noise = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const w = noise();
    // crack: high-passed noise (difference of a one-pole low-pass), 18 ms decay
    lp += 0.25 * (w - lp);
    const crack = (w - lp) * Math.exp(-t / 0.018) * 1.1;
    // knock: 70 Hz thump falling to 45 Hz, 180 ms decay
    const f = 45 + 25 * Math.exp(-t / 0.08);
    const knock = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.18) * 0.8;
    // rattle: bursts of noise every ~35 ms, fading over the clip
    const r = (t % 0.035) < 0.006 ? w * 0.35 * Math.exp(-t / 0.35) : 0;
    out[i] = Math.max(-1, Math.min(1, crack + knock + r * (t > 0.05 ? 1 : 0)));
  }
  return out;
}

/** Plays the one-shot on the master chain (no-op without a running audio context). */
export function playBlownEngine(audio: AudioEngine, gain = 0.7): void {
  const ctx = audio.ctx;
  if (!ctx || !audio.master || !audio.running) return;
  const data = renderBlownEngine(ctx.sampleRate);
  const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buf.copyToChannel(data, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(audio.master);
  src.start();
}
