import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CH, CHANNELS } from '../../../src/audio/dsp/AcousticConfig';
import type { TurboAcousticModel } from '../../../src/audio/dsp/turbo/TurboAcousticTypes';
import { turboMetrics } from '../../../src/audio/analysis/turboLab';
import { referenceTurboBuilds } from '../../../src/audio/analysis/turboBuilds';
import { fnvFloat32, HASH_CARS, HASH_PHASES, HASH_TURBO_BUILDS, physicsFingerprint, renderTurboPhysics } from '../../../src/audio/analysis/turboPhysics';
import { carById } from './turboTestUtils';

/**
 * Regression against the baseline captured on `main` before Turbo Acoustics 2.0
 * (docs/audio-turbo/before, see scripts/audio-turbo-baseline.ts and audio-turbo-channel-hash.ts).
 *  - the physics is bit-identical for the same inputs, seeds and builds (spec 24.6);
 *  - the channels not related to the turbo are preserved (spec 24.7).
 */
const BEFORE = join(__dirname, '../../../docs/audio-turbo/before');
const physicsBefore = JSON.parse(readFileSync(join(BEFORE, 'physics-fingerprint.json'), 'utf8')) as Record<string, { config: string; frames: string }>;
const levelBefore = JSON.parse(readFileSync(join(BEFORE, 'legacy-turbo-level.json'), 'utf8')) as Record<string, { rms: number; centroidHz: number }>;
const hashBefore = JSON.parse(readFileSync(join(BEFORE, 'channel-hash.json'), 'utf8')) as Record<string, Record<string, string>>;

/** The transmission noise used the old shared turbo PRNG on turbo cars; v2 gives the turbo its own streams. */
const TURBO_DEPENDENT = new Set<number>([CH.turbo, CH.transmission]);

const render = (car: ReturnType<typeof carById>, model: TurboAcousticModel) =>
  renderTurboPhysics(car, 48000, { phases: HASH_PHASES, acoustic: (c) => ({ ...c, turboModel: model }) });
const hashes = (car: ReturnType<typeof carById>, model: TurboAcousticModel, keep?: (r: ReturnType<typeof render>) => void): Record<string, string> => {
  const r = render(car, model);
  keep?.(r);
  return Object.fromEntries(CHANNELS.map((c, k) => [c, fnvFloat32(r.ch[k]!)]));
};

describe('Turbo Acoustics 2.0 — physics and channel regression', () => {
  const physicsIds = [...HASH_TURBO_BUILDS, 'vw-saveiro-gl-1994', 'mitsubishi-evo-x-2012', 'honda-civic-si-2008', 'nissan-370z-2014', 'vetra-rs', 'alfa-giulia-qv-2017'];
  for (const b of referenceTurboBuilds(physicsIds)) {
    it(`physics unchanged: ${b.id}`, { timeout: 60_000 }, () => {
      const before = physicsBefore[b.id];
      expect(before, `${b.id} missing from the baseline`).toBeDefined();
      const now = physicsFingerprint(b.car);
      expect(now.config).toBe(before!.config);
      expect(now.frames).toBe(before!.frames);
    });
  }

  for (const id of HASH_CARS) {
    it(`NA car ${id}: every channel bit-identical to main`, { timeout: 60_000 }, () => {
      const car = carById(id);
      expect(car.engine.induction).not.toBe('turbo');
      expect(hashes(car, 'hybrid')).toEqual(hashBefore[`${id}/stock`]);
    });
  }

  for (const b of referenceTurboBuilds(HASH_TURBO_BUILDS)) {
    it(`turbo build ${b.id}: non-turbo channels bit-identical to main; legacy turbo level reproduced`, { timeout: 90_000 }, () => {
      const before = hashBefore[b.id]!;
      expect(before).toBeDefined();
      let legacyTurbo: Float32Array = new Float32Array(0);
      const legacy = hashes(b.car, 'legacy', (r) => (legacyTurbo = r.ch[CH.turbo]!));
      const v2 = hashes(b.car, 'v2');
      const hybrid = hashes(b.car, 'hybrid');
      expect(hybrid.turbo).not.toBe(v2.turbo);
      CHANNELS.forEach((c, k) => {
        if (k !== CH.turbo) expect(hybrid[c], `${c} (hybrid vs 2.0)`).toBe(v2[c]);
        if (!TURBO_DEPENDENT.has(k)) {
          expect(legacy[c], `${c} (legacy)`).toBe(before[c]);
          expect(v2[c], `${c} (v2)`).toBe(before[c]);
        }
      });
      // The legacy model is kept verbatim for the A/B comparison. Its noise now comes from its own
      // PRNG stream (on main it was shared with the transmission), so the samples differ but the level
      // and spectral balance are the same.
      const lv = levelBefore[b.id]!;
      const m = turboMetrics(legacyTurbo, 48000);
      expect(Math.abs(20 * Math.log10(m.rms / lv.rms))).toBeLessThan(0.5);
      expect(Math.abs(m.centroidHz / lv.centroidHz - 1)).toBeLessThan(0.05);
      // the transmission no longer depends on the turbo model
      expect(v2[CHANNELS[CH.transmission]!]).toBe(legacy[CHANNELS[CH.transmission]!]);
    });
  }
});
