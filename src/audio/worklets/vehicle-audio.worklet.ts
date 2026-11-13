/// <reference path="./worklet-env.d.ts" />
/**
 * AudioWorklet processor: one vehicle voice, 7 mono outputs (intake, block, exhaust, turbo, tire,
 * transmission, environment). Receives physics telemetry frames by message, renders the acoustic
 * model at the context's real sample rate. All DSP state is allocated when a voice is built
 * (construction / config message), never inside `process`.
 */
import { AF } from '../../core/contracts';
import { CHANNEL_COUNT, type AcousticVehicleConfig } from '../dsp/AcousticConfig';
import { VehicleAcoustics } from '../dsp/VehicleAcoustics';
import { VEHICLE_PROCESSOR, type ToWorklet, type VehicleProcessorOptions, type WorkletStats } from './protocol';

const CROSSFADE_S = 0.04;
const STATS_INTERVAL_S = 0.5;

class VehicleAudioProcessor extends AudioWorkletProcessor {
  private voice: VehicleAcoustics;
  private old: VehicleAcoustics | null = null;
  private oldGain = 0;
  private readonly oldStep: number;
  private readonly latencyS: number;
  private ambientK: number;
  private disposed = false;
  private renderedS = 0;
  private lastStatsS = 0;
  private starvedAcc = 0;
  private readonly scratch: Float32Array[];
  private readonly outs: (Float32Array | undefined)[] = new Array(CHANNEL_COUNT).fill(undefined);

  constructor(options: AudioWorkletNodeOptions) {
    super(options);
    const opts = options.processorOptions as VehicleProcessorOptions;
    this.latencyS = opts.latencyS;
    this.ambientK = opts.ambientK;
    this.voice = this.build(opts.config);
    this.oldStep = 1 / (CROSSFADE_S * sampleRate);
    this.scratch = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(128));
    this.port.onmessage = (ev: MessageEvent<ToWorklet>) => this.onMessage(ev.data);
  }

  private build(config: AcousticVehicleConfig): VehicleAcoustics {
    const v = new VehicleAcoustics(sampleRate, config, this.latencyS);
    v.ambientK = this.ambientK;
    return v;
  }

  /** Swaps in a new voice; the previous one keeps rendering under a short fade-out (no click). */
  private replace(config: AcousticVehicleConfig): void {
    const next = this.build(config);
    this.old = this.voice;
    this.oldGain = 1;
    this.voice = next;
  }

  private onMessage(m: ToWorklet): void {
    switch (m.type) {
      case 'frames': {
        const d = m.data;
        for (let i = 0; i < m.count; i++) {
          this.voice.pushFrame(d, i * AF.length);
          if (this.old) this.old.pushFrame(d, i * AF.length);
        }
        break;
      }
      case 'config':
        this.replace(m.config);
        break;
      case 'quality':
        if (m.quality !== this.voice.config.quality) this.replace({ ...this.voice.config, quality: m.quality });
        break;
      case 'ambient':
        this.ambientK = m.ambientK;
        this.voice.ambientK = m.ambientK;
        break;
      case 'reset':
        this.voice.reset();
        break;
      case 'dispose':
        this.disposed = true;
        this.port.close();
        break;
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    if (this.disposed) return false;
    const n = outputs[0]?.[0]?.length ?? 128;
    for (let k = 0; k < CHANNEL_COUNT; k++) this.outs[k] = outputs[k]?.[0];
    this.voice.render(this.outs, n);
    if (this.old) {
      const s = this.scratch;
      if (s[0]!.length < n) for (let k = 0; k < CHANNEL_COUNT; k++) s[k] = new Float32Array(n); // only if the quantum grows
      this.old.render(s, n);
      for (let j = 0; j < n; j++) {
        this.oldGain -= this.oldStep;
        const g = this.oldGain > 0 ? this.oldGain : 0;
        for (let k = 0; k < CHANNEL_COUNT; k++) {
          const o = this.outs[k];
          if (o) o[j] = o[j]! + s[k]![j]! * g;
        }
      }
      if (this.oldGain <= 0) this.old = null;
    }
    this.renderedS += n / sampleRate;
    if (this.voice.stream.starvedS > 0) this.starvedAcc += n / sampleRate;
    if (this.renderedS - this.lastStatsS >= STATS_INTERVAL_S) {
      this.lastStatsS = this.renderedS;
      const v = this.voice;
      const st = v.stream;
      const stats: WorkletStats = {
        type: 'stats',
        renderedS: this.renderedS,
        receivedFrames: st.receivedFrames,
        rejectedFrames: st.rejectedFrames,
        resyncs: st.resyncs,
        starvedS: this.starvedAcc,
        nanResets: v.nanResets,
        peak: Array.from(v.peak),
        playbackRate: st.rate,
        fade: st.fade,
      };
      this.port.postMessage(stats);
      this.starvedAcc = 0;
      v.resetStats();
    }
    return true;
  }
}

registerProcessor(VEHICLE_PROCESSOR, VehicleAudioProcessor);
