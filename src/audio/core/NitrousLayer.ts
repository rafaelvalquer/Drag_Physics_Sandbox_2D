/**
 * Nitrous layer of a vehicle's sound (procedural, main thread): a pressurised hiss whose level follows
 * the injected flow, and the short clicks of the solenoid opening and closing. It plugs into the
 * vehicle's own bus, so the spatialisation, the master mute and the engine voice are untouched; the
 * engine itself changes by itself (the extra torque and load reach the worklet through the physics
 * frames). Deterministic noise (LCG), no files, no clipping: the hiss is capped well under the engine.
 */
const HISS_MAX_GAIN = 0.14;
const CLICK_GAIN = 0.3;
const WHOOSH_GAIN = 0.42;

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

/**
 * What the injection does to the engine voice, as pure numbers (testable without WebAudio): the exhaust channel gets louder and
 * brighter with the flow, and the first moments of an injection add a short decaying bump to the apparent engine speed
 * ("the engine breathes harder"). The bump is only in the audio frames; the physics rpm is never touched.
 */
export const NITRO_EXHAUST_GAIN = 0.22; // + this × flow on the exhaust channel
export const NITRO_SHELF_DB = 4; // high shelf, dB at full flow
export const NITRO_RPM_BUMP = 0.035; // +3.5 % apparent speed at the attack
export const NITRO_BUMP_TAU_S = 0.25;

export class NitrousVoiceState {
  /** Apparent-speed bump (fraction) still to decay. */
  bump = 0;
  /** Smoothed flow 0..1 the voice follows. */
  flow = 0;
  private active = false;

  /** Advances by dt seconds; returns true on the step an injection starts. */
  update(dt: number, active: boolean, flowNorm: number): boolean {
    const d = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.25) : 0;
    const started = active && !this.active;
    this.active = active;
    if (started) this.bump = NITRO_RPM_BUMP;
    else this.bump *= Math.exp(-d / NITRO_BUMP_TAU_S);
    if (this.bump < 1e-4) this.bump = 0;
    const target = active && Number.isFinite(flowNorm) ? Math.min(1, Math.max(0, flowNorm)) : 0;
    this.flow += (target - this.flow) * (1 - Math.exp(-d / 0.08));
    return started;
  }

  get exhaustMul(): number {
    return 1 + NITRO_EXHAUST_GAIN * this.flow;
  }

  get shelfDb(): number {
    return NITRO_SHELF_DB * this.flow;
  }
}

export class NitrousLayer {
  private readonly hiss: AudioBufferSourceNode;
  private readonly hissGain: GainNode;
  private readonly filters: BiquadFilterNode[] = [];
  private readonly clickBuf: AudioBuffer;
  private readonly whooshBuf: AudioBuffer;
  private opening: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private readonly clicks = new Set<AudioBufferSourceNode>();
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
    this.whooshBuf = noiseBuffer(ctx, 0.5, 0x2b7e1516);
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
    if (!open) this.releaseWhoosh();
    if (this.clicks.size >= 2) return;
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
    this.clicks.add(src);
    src.onended = () => {
      this.clicks.delete(src);
      src.disconnect();
      bp.disconnect();
      g.disconnect();
    };
    src.start(t);
    src.stop(t + 0.04);
  }

  /**
   * Opening whoosh: a gas jet of about 0.35 s whose noise sweeps from low to high (a band-pass opening upward) with a sharp attack
   * and a soft decay: the "pssshh" of the solenoid letting the oxidiser go. `strength` 0..1 scales its level.
   */
  whoosh(strength: number): void {
    if (this.disposed || this.opening) return;
    const k = Math.min(1, Math.max(0.2, strength));
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.whooshBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(450, t);
    bp.frequency.exponentialRampToValueAtTime(7000, t + 0.3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(WHOOSH_GAIN * k, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    src.connect(bp).connect(g).connect(this.destination);
    this.opening = { source: src, gain: g };
    src.onended = () => {
      if (this.opening?.source === src) this.opening = null;
      src.disconnect();
      bp.disconnect();
      g.disconnect();
    };
    src.start(t);
    src.stop(t + 0.42);
  }

  private releaseWhoosh(): void {
    if (!this.opening) return;
    const { source, gain } = this.opening;
    const now = this.ctx.currentTime;
    gain.gain.cancelAndHoldAtTime(now);
    gain.gain.setTargetAtTime(0, now, 0.012);
    source.stop(now + 0.06);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.releaseWhoosh();
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
