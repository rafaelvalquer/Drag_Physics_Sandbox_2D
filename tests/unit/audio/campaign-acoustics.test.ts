import { describe, expect, it } from 'vitest';
import { CAMPAIGN_CARS } from '../../../src/data/cars/campaign';
import { BUILT_IN_SANDBOX_PRESETS } from '../../../src/data/cars/sandboxPresets';
import { carToAcousticConfig, CHANNEL_COUNT, CH } from '../../../src/audio/dsp/AcousticConfig';
import { VehicleAcoustics } from '../../../src/audio/dsp/VehicleAcoustics';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';
import { TRACKS } from '../../../src/data/tracks/index';
import { listCalibrationCases } from '../../../src/audio/analysis/calibrationCases';

const STEP = 1 / 120;
describe('Brazilian engine acoustic integration', () => {
  it('registers every stock and all valid prepared scenarios in one source', () => {
    const cases = listCalibrationCases({ scope: 'campaign', variant: 'all' });
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const car of CAMPAIGN_CARS) expect(cases.some((c) => c.car === car && c.variant === 'stock')).toBe(true);
    for (const preset of BUILT_IN_SANDBOX_PRESETS) expect(cases.some((c) => c.id === preset.id)).toBe(true);
  });
  for (const car of CAMPAIGN_CARS) {
    for (const quality of ['high', 'low'] as const) {
      for (const rate of [44100, 48000]) {
        it(car.id + ' / ' + quality + ' / ' + rate + ': finite seven-channel physics-driven output', () => {
          const config = carToAcousticConfig(car, quality, 11);
          expect(config.engine.firingAnglesDeg).toEqual(car.engine.firingAnglesDeg);
          const sim = new VehicleSimulation(car, TRACKS[0]!);
          const voice = new VehicleAcoustics(rate, config);
          const out = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(Math.ceil(rate * STEP) + 2));
          let acc = 0, peak = 0;
          for (let i = 0; i < 180; i++) {
            sim.controls.pedal = i < 90 ? 0 : 0.65;
            sim.step(STEP);
            voice.pushFrame(sim.audioFrame);
            acc += rate * STEP;
            const n = Math.floor(acc);
            acc -= n;
            voice.render(out, n);
            for (let k = 0; k < CHANNEL_COUNT; k++) for (let j = 0; j < n; j++) {
              const v = out[k]![j]!;
              expect(Number.isFinite(v)).toBe(true);
              peak = Math.max(peak, Math.abs(v));
            }
            for (let j = 0; j < n; j++) expect(Math.abs(out[CH.turbo]![j]!)).toBeLessThan(1e-8);
          }
          expect(voice.nanResets).toBe(0);
          expect(voice.stream.rejectedFrames).toBe(0);
          expect(peak).toBeGreaterThan(0.00001);
        });
      }
    }
  }
  it('Marcos has turbo channel enabled by the resolved engine', () => {
    const preset = BUILT_IN_SANDBOX_PRESETS.find((p) => p.id === 'vw-saveiro-marcos-turbo-sandbox')!;
    expect(preset.car.engine.induction).toBe('turbo');
    expect(carToAcousticConfig(preset.car).acoustic.turboGain).toBeGreaterThan(0);
    expect(preset.car.engine.turbo).toBeDefined();
  });
});
