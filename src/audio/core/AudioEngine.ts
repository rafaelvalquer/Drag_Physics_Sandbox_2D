import workletUrl from '../worklets/vehicle-audio.worklet.ts?worker&url';

export type AudioEngineState = 'idle' | 'starting' | 'running' | 'suspended' | 'failed';

/**
 * Owns the AudioContext and the master chain:
 *   voices → master gain → limiter (DynamicsCompressor, fast attack, high ratio) → analyser → out
 * The context is created lazily on a user gesture (browser autoplay policy). Sample rate is
 * whatever the device provides (44.1/48/96 kHz …); every DSP coefficient derives from it.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  limiter: DynamicsCompressorNode | null = null;
  analyser: AnalyserNode | null = null;
  state: AudioEngineState = 'idle';
  error: string | null = null;
  private starting: Promise<void> | null = null;
  private masterVolume = 0.5;
  private muted = false;

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 0;
  }

  get running(): boolean {
    return this.state === 'running';
  }

  /** Must be called from a user gesture the first time. Idempotent. */
  start(): Promise<void> {
    if (this.state === 'running') return Promise.resolve();
    if (this.starting) return this.starting;
    this.state = 'starting';
    this.starting = (async () => {
      try {
        if (!this.ctx) {
          const ctx = new AudioContext({ latencyHint: 'interactive' });
          await ctx.audioWorklet.addModule(workletUrl);
          const master = ctx.createGain();
          master.gain.value = this.muted ? 0 : this.masterVolume;
          const limiter = ctx.createDynamicsCompressor();
          // gentle bus compression with a brick-wall-ish top: keeps idle audible and peaks < 0 dBFS
          limiter.threshold.value = -18;
          limiter.knee.value = 6;
          limiter.ratio.value = 8;
          limiter.attack.value = 0.003;
          limiter.release.value = 0.15;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 4096;
          analyser.smoothingTimeConstant = 0.6;
          master.connect(limiter);
          limiter.connect(analyser);
          analyser.connect(ctx.destination);
          this.ctx = ctx;
          this.master = master;
          this.limiter = limiter;
          this.analyser = analyser;
        }
        if (this.ctx.state !== 'running') await this.ctx.resume();
        this.state = 'running';
        this.error = null;
      } catch (e) {
        this.state = 'failed';
        this.error = e instanceof Error ? e.message : String(e);
        throw e;
      } finally {
        this.starting = null;
      }
    })();
    return this.starting;
  }

  async suspend(): Promise<void> {
    if (this.ctx && this.ctx.state === 'running') {
      await this.ctx.suspend();
      this.state = 'suspended';
    }
  }

  setMasterVolume(v: number): void {
    this.masterVolume = Math.min(1, Math.max(0, v));
    this.applyVolume();
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolume();
  }

  isMuted(): boolean {
    return this.muted;
  }

  private applyVolume(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.masterVolume, t, 0.03);
  }

  async close(): Promise<void> {
    if (this.ctx) await this.ctx.close();
    this.ctx = null;
    this.master = null;
    this.limiter = null;
    this.analyser = null;
    this.state = 'idle';
  }
}

/** Shared engine for the application. */
export const audioEngine = new AudioEngine();
