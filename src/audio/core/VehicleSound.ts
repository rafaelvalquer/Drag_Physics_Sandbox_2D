import { AF } from '../../core/contracts';
import { CHANNELS, CHANNEL_COUNT, CH, type AcousticQuality, type AcousticVehicleConfig } from '../dsp/AcousticConfig';
import { VEHICLE_PROCESSOR, type ToWorklet, type VehicleProcessorOptions, type WorkletStats } from '../worklets/protocol';
import type { AudioEngine } from './AudioEngine';
import { NitrousLayer } from './NitrousLayer';

const SPEED_OF_SOUND = 343;
const MAX_FRAMES_PER_POST = 64;

/** Per-channel mixer levels set by the user (Sandbox acoustic editor / settings). */
export type ChannelMix = Record<(typeof CHANNELS)[number], number>;

export const DEFAULT_MIX: ChannelMix = {
  intake: 0.8,
  block: 0.7,
  exhaust: 1,
  turbo: 0.8,
  tire: 0.8,
  transmission: 0.6,
  environment: 0.5,
};

/**
 * Main-thread side of one vehicle voice:
 *   AudioWorkletNode (7 mono outputs) → per-channel GainNodes → bus → StereoPanner → Doppler
 *   delay → distance gain → master.
 *
 * ORIGIN of the Doppler path (MIT © Antonio-R1, engine-sound-generator `sound_generator_worklet.js`
 * / `SoundGenerator`): the propagation delay distance/c applied with a DelayNode and linear ramps.
 * CHANGES: speed of sound constant shared with the rest of the code, ramps over the frame period
 * (no zipper), distance attenuation and equal-power panning from the lateral offset.
 *
 * Telemetry: `pushFrame` copies the physics audio frame into a batch that is posted once per
 * rendered frame (`flush`), so message traffic is ~60 posts/s regardless of the physics rate.
 */
export class VehicleSound {
  /** Number of voices created and not yet disposed (resource-leak check in tests and DevLab). */
  static live = 0;
  readonly node: AudioWorkletNode;
  private readonly gains: GainNode[] = [];
  private readonly bus: GainNode;
  private readonly panner: StereoPannerNode;
  private readonly delay: DelayNode;
  private readonly distanceGain: GainNode;
  private batch = new Float64Array(MAX_FRAMES_PER_POST * AF.length);
  private batchCount = 0;
  private mix: ChannelMix = { ...DEFAULT_MIX };
  private disposed = false;
  private nitrous: NitrousLayer | null = null;
  private nitrousStatus = 'READY';
  lastStats: WorkletStats | null = null;
  droppedFrames = 0;

  constructor(
    private readonly engine: AudioEngine,
    config: AcousticVehicleConfig,
    readonly label: string,
    latencyS = 0.05,
    ambientK = 298,
  ) {
    const ctx = engine.ctx;
    if (!ctx || !engine.master) throw new Error('AudioEngine not started');
    const opts: VehicleProcessorOptions = { config, latencyS, ambientK };
    this.node = new AudioWorkletNode(ctx, VEHICLE_PROCESSOR, {
      numberOfInputs: 0,
      numberOfOutputs: CHANNEL_COUNT,
      outputChannelCount: new Array(CHANNEL_COUNT).fill(1),
      processorOptions: opts,
    });
    this.node.port.onmessage = (ev: MessageEvent<WorkletStats>) => {
      if (ev.data?.type === 'stats') this.lastStats = ev.data;
    };
    this.bus = ctx.createGain();
    for (let k = 0; k < CHANNEL_COUNT; k++) {
      const g = ctx.createGain();
      g.gain.value = this.mix[CHANNELS[k]!];
      this.node.connect(g, k, 0);
      g.connect(this.bus);
      this.gains.push(g);
    }
    this.panner = ctx.createStereoPanner();
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = 0;
    this.distanceGain = ctx.createGain();
    this.bus.connect(this.panner);
    this.panner.connect(this.delay);
    this.delay.connect(this.distanceGain);
    this.distanceGain.connect(engine.master);
    VehicleSound.live++;
  }

  /**
   * Follows the N₂O state of the simulation: the hiss tracks the injected flow (0..1 of the kit's
   * maximum), the solenoid clicks when an injection starts and when it ends. Cheap enough to call
   * every rendered frame; the layer is created on the first injection.
   */
  syncNitrous(status: string, flowNorm: number): void {
    if (this.disposed) return;
    const ctx = this.engine.ctx;
    if (!ctx) return;
    const active = status === 'STAGE_1_ACTIVE' || status === 'STAGE_2_ACTIVE';
    const was = this.nitrousStatus === 'STAGE_1_ACTIVE' || this.nitrousStatus === 'STAGE_2_ACTIVE';
    if (!this.nitrous && active) this.nitrous = new NitrousLayer(ctx, this.bus);
    if (active && !was) this.nitrous?.click(true);
    if (!active && was) this.nitrous?.click(false);
    if (this.nitrousStatus !== status) this.nitrousStatus = status;
    this.nitrous?.setFlow(active ? flowNorm : 0);
  }

  /** Queues one physics audio frame (AF layout). */
  pushFrame(frame: Float64Array): void {
    if (this.disposed) return;
    if (this.batchCount >= MAX_FRAMES_PER_POST) {
      this.flush();
    }
    this.batch.set(frame, this.batchCount * AF.length);
    this.batchCount++;
  }

  /** Posts the queued frames to the worklet (call once per rendered frame). */
  flush(): void {
    if (this.disposed || this.batchCount === 0) return;
    const data = this.batch.slice(0, this.batchCount * AF.length);
    const msg: ToWorklet = { type: 'frames', count: this.batchCount, data };
    this.node.port.postMessage(msg, [data.buffer]);
    this.batchCount = 0;
  }

  setMix(mix: Partial<ChannelMix>): void {
    this.mix = { ...this.mix, ...mix };
    const ctx = this.engine.ctx;
    if (!ctx) return;
    for (let k = 0; k < CHANNEL_COUNT; k++) this.gains[k]!.gain.setTargetAtTime(this.mix[CHANNELS[k]!], ctx.currentTime, 0.03);
  }

  getMix(): ChannelMix {
    return { ...this.mix };
  }

  /** Solo one channel (or null for all) – used by the Developer Lab. */
  solo(channel: number | null): void {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    for (let k = 0; k < CHANNEL_COUNT; k++) {
      const v = channel === null || channel === k ? this.mix[CHANNELS[k]!] : 0;
      this.gains[k]!.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
    }
  }

  /**
   * Places the source relative to the listener: lateral offset (m, + = right), distance (m) and
   * the period over which the change applies (s). Doppler comes from the changing delay.
   */
  setSpatial(lateralM: number, distanceM: number, rampS = 1 / 60): void {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const d = Math.max(0, distanceM);
    const delayS = Math.min(1.9, d / SPEED_OF_SOUND);
    this.delay.delayTime.cancelScheduledValues(t);
    this.delay.delayTime.setValueAtTime(this.delay.delayTime.value, t);
    this.delay.delayTime.linearRampToValueAtTime(delayS, t + Math.max(rampS, 0.005));
    const ref = 6;
    const g = ref / Math.max(ref, d);
    this.distanceGain.gain.setTargetAtTime(g, t, 0.03);
    const pan = Math.max(-1, Math.min(1, lateralM / Math.max(4, Math.abs(lateralM) + 2)));
    this.panner.pan.setTargetAtTime(pan, t, 0.03);
  }

  setQuality(q: AcousticQuality): void {
    this.post({ type: 'quality', quality: q });
  }

  setConfig(config: AcousticVehicleConfig): void {
    this.post({ type: 'config', config });
  }

  setAmbient(ambientK: number): void {
    this.post({ type: 'ambient', ambientK });
  }

  reset(): void {
    this.batchCount = 0;
    this.post({ type: 'reset' });
  }

  private post(m: ToWorklet): void {
    if (!this.disposed) this.node.port.postMessage(m);
  }

  dispose(): void {
    if (this.disposed) return;
    this.post({ type: 'dispose' });
    this.disposed = true;
    this.nitrous?.dispose();
    this.nitrous = null;
    VehicleSound.live--;
    try {
      this.node.disconnect();
      for (const g of this.gains) g.disconnect();
      this.bus.disconnect();
      this.panner.disconnect();
      this.delay.disconnect();
      this.distanceGain.disconnect();
    } catch {
      // already disconnected
    }
    this.node.port.onmessage = null;
  }

  /** Index helpers for UI code. */
  static readonly CH = CH;
}
