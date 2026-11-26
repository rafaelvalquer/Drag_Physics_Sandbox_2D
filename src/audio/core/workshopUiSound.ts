import type { AudioEngine } from './AudioEngine';

/**
 * Discreet interface sounds of the workshop (procedural, a few tens of milliseconds): a soft tick
 * for selecting a part, a lower one for changing category, a short rising pair when an install is
 * confirmed and a muted buzz for an unavailable action. They go through the master chain, so the
 * master volume and the mute respect them; with no running audio context they do nothing.
 */
export type WorkshopSound = 'select' | 'category' | 'installed' | 'denied';

const SPEC: Record<WorkshopSound, { freqs: number[]; type: OscillatorType; gain: number; step: number; dur: number }> = {
  select: { freqs: [1040], type: 'sine', gain: 0.05, step: 0, dur: 0.05 },
  category: { freqs: [660], type: 'sine', gain: 0.05, step: 0, dur: 0.07 },
  installed: { freqs: [523, 784], type: 'triangle', gain: 0.07, step: 0.09, dur: 0.16 },
  denied: { freqs: [180], type: 'square', gain: 0.03, step: 0, dur: 0.09 },
};

export function playWorkshopSound(audio: AudioEngine, kind: WorkshopSound): void {
  const ctx = audio.ctx;
  if (!ctx || !audio.master || !audio.running) return;
  const s = SPEC[kind];
  const t0 = ctx.currentTime;
  s.freqs.forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = s.type;
    o.frequency.value = f;
    const g = ctx.createGain();
    const t = t0 + i * s.step;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(s.gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
    o.connect(g).connect(audio.master!);
    o.start(t);
    o.stop(t + s.dur + 0.02);
  });
}
