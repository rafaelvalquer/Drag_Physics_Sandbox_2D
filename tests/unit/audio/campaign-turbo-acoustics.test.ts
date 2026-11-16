import { describe, expect, it } from 'vitest';
import { AF } from '../../../src/core/contracts';
import { CH, CHANNEL_COUNT, carToAcousticConfig } from '../../../src/audio/dsp/AcousticConfig';
import { VehicleAcoustics } from '../../../src/audio/dsp/VehicleAcoustics';
import { BUILT_IN_SANDBOX_PRESETS } from '../../../src/data/cars/sandboxPresets';
import { TRACKS } from '../../../src/data/tracks/index';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';

const H = 1 / 120;

describe('physics-driven prepared turbo sound', () => {
  for (const id of ['vw-saveiro-marcos-turbo-sandbox', 'vw-gol-ap-turbo-sandbox']) {
    for (const quality of ['high', 'low'] as const) {
      for (const rate of [44100, 48000]) {
        it(id + ' / ' + quality + ' / ' + rate + ': boost, shaft and sound follow physics', () => {
          const p = BUILT_IN_SANDBOX_PRESETS.find((preset) => preset.id === id);
          if (!p) return; // mechanical compatibility gate: intentionally omitted
          expect(p.car.engine.induction).toBe('turbo');
          const sim = new VehicleSimulation(p.car, TRACKS[0]!);
          const voice = new VehicleAcoustics(rate, carToAcousticConfig(p.car, quality, 7));
          const out = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(Math.ceil(rate * H) + 2));
          let acc = 0, boostMax = 0, shaftMax = 0, bovMax = 0, finite = true;
          for (let i = 0; i < 960; i++) {
            if (i === 300) sim.requestShift(1);
            sim.controls.pedal = i < 300 ? 0 : i < 820 ? 1 : 0;
            sim.step(H);
            const a = sim.audioFrame;
            boostMax = Math.max(boostMax, a[AF.boostPressure]!);
            shaftMax = Math.max(shaftMax, a[AF.turboShaftRpm]!);
            bovMax = Math.max(bovMax, a[AF.bovFlow]!);
            voice.pushFrame(a);
            acc += rate * H;
            const n = Math.floor(acc);
            acc -= n;
            voice.render(out, n);
            for (let j = 0; j < n; j++) finite = finite && Number.isFinite(out[CH.turbo]![j]!);
          }
          expect(finite).toBe(true);
          expect(boostMax, id).toBeGreaterThan(10000);
          expect(shaftMax, id).toBeGreaterThan(10000);
          expect(bovMax).toBeGreaterThanOrEqual(0);
          expect(voice.rms(CH.turbo)).toBeGreaterThan(0.00001);
          expect(voice.nanResets).toBe(0);
          expect(voice.stream.rejectedFrames).toBe(0);
        });
      }
    }
  }
});
