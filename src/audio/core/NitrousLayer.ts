/**
 * Nitrous layer of a vehicle's sound (procedural, main thread): a pressurised hiss whose level follows
 * the injected flow, and the short clicks of the solenoid opening and closing. It plugs into the
 * vehicle's own bus, so the spatialisation, the master mute and the engine voice are untouched; the
 * engine itself changes by itself (the extra torque and load reach the worklet through the physics
 * frames). Deterministic noise (LCG), no files, no clipping: the hiss is capped well under the engine.
 */
const HISS_MAX_GAIN = 0.14;
const CLICK_GAIN = 0.3;

function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed: number): AudioBuffer {
  const n = Math.round(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let s = seed >>> 0;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    d[i] = s / 2147483648 - 1;
  }
  return buf;
}

export class NitrousLayer {
  private readonly hiss: AudioBufferSourceNode;
  private readonly hissGain: GainNode;
  private readonly filters: BiquadFilterNode[] = [];
  private readonly clickBuf: AudioBuffer;
  private disposed = false;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly destination: AudioNode,
  ) {
    this.hiss = ctx.createBufferSource();
    this.hiss.buffer = noiseBuffer(ctx, 2, 0x51ed270b);
    this.hiss.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 9500;
    this.filters.push(hp, lp);
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0;
    this.hiss.connect(hp).connect(lp).connect(this.hissGain).connect(destination);
    this.hiss.start();
    this.clickBuf = noiseBuffer(ctx, 0.03, 0x1d2c3b4a);
  }

  /** Level of the flow 0..1 (injected flow over the kit's maximum): follows it smoothly. */
  setFlow(norm: number): void {
    if (this.disposed) return;
    const n = Math.min(1, Math.max(0, norm));
    this.hissGain.gain.setTargetAtTime(HISS_MAX_GAIN * n ** 0.8, this.ctx.currentTime, 0.05);
  }

  /** Solenoid click: a short filtered burst (stronger when it opens). */
  click(open: boolean): void {
    if (this.disposed) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.clickBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = open ? 2600 : 1800;
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(CLICK_GAIN * (open ? 1 : 0.7), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    src.connect(bp).connect(g).connect(this.destination);
    src.start(t);
    src.stop(t + 0.04);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.hiss.stop();
    } catch {
      /* already stopped */
    }
    this.hiss.disconnect();
    for (const f of this.filters) f.disconnect();
    this.hissGain.disconnect();
  }
}
