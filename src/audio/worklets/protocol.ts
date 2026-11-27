import type { AcousticQuality, AcousticVehicleConfig, TurboAudioOptions } from '../dsp/AcousticConfig';

/** Name under which the vehicle voice processor is registered. */
export const VEHICLE_PROCESSOR = 'vehicle-audio';

export interface VehicleProcessorOptions {
  config: AcousticVehicleConfig;
  latencyS: number;
  ambientK: number;
}

/** Main thread → worklet. */
export type ToWorklet =
  | { type: 'frames'; count: number; data: Float64Array }
  | { type: 'config'; config: AcousticVehicleConfig }
  | { type: 'turbo-comparison'; options: TurboAudioOptions }
  | { type: 'quality'; quality: AcousticQuality; turboComparisonGain?: number }
  | { type: 'ambient'; ambientK: number }
  | { type: 'reset' }
  | { type: 'dispose' };

/** Worklet → main thread (diagnostics, shown in the Developer Lab). */
export interface WorkletStats {
  type: 'stats';
  /** Audio time rendered (s). */
  renderedS: number;
  receivedFrames: number;
  rejectedFrames: number;
  resyncs: number;
  /** Seconds the playback clock ran past the newest frame (telemetry underrun) in the last report. */
  starvedS: number;
  nanResets: number;
  /** Peak per channel since the last report. */
  peak: number[];
  /** Playback clock rate of the jitter buffer (1 ± 0.02). */
  playbackRate: number;
  fade: number;
}
