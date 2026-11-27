/**
 * Baseline capture (P0): legacy turbo metrics + physics fingerprints of the reference builds.
 * Run on the commit BEFORE Turbo Acoustics 2.0 (a `main` worktree with the src/audio/analysis/turbo*
 * lab files copied in) and again after it; the regression test compares the physics fingerprints.
 *   npx tsx scripts/audio-turbo-baseline.ts --out=docs/audio-turbo/before
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CH, carToAcousticConfig } from '../src/audio/dsp/AcousticConfig';
import { TURBO_SCENARIOS, renderTurboScenario, turboMetrics } from '../src/audio/analysis/turboLab';
import { physicsFingerprint, renderTurboPhysics } from '../src/audio/analysis/turboPhysics';
import { referenceTurboBuilds } from '../src/audio/analysis/turboBuilds';

const out = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1] ?? 'docs/audio-turbo/before';
const model = process.argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'legacy';
const skipAudio = process.argv.includes('--physics-only');
mkdirSync(out, { recursive: true });
const fs = 48000;
const physics: Record<string, unknown> = {};
const rows: unknown[] = [];
for (const b of referenceTurboBuilds()) {
  physics[b.id] = { partIds: b.partIds, tune: b.tune, ...physicsFingerprint(b.car) };
  if (skipAudio) continue;
  for (const sc of [...TURBO_SCENARIOS, 'physics'] as const) {
    const t0 = performance.now();
    const r = sc === 'physics'
      ? renderTurboPhysics(b.car, fs, { acoustic: (c) => ({ ...c, turboModel: model as 'legacy' }) })
      : renderTurboScenario({ ...carToAcousticConfig(b.car, 'high', 1), turboModel: model as 'legacy' }, fs, sc);
    const ms = performance.now() - t0;
    const x = r.ch[CH.turbo]!;
    rows.push({ build: b.id, model, scenario: sc, msPerS: ms / (x.length / fs), ...turboMetrics(x, fs, Math.round(0.3 * fs)) });
  }
  console.log(b.id, JSON.stringify(physics[b.id]));
}
writeFileSync(join(out, 'physics-fingerprint.json'), JSON.stringify(physics, null, 1));
if (!skipAudio) writeFileSync(join(out, 'metrics.json'), JSON.stringify({ rate: fs, model, rows }, null, 1));
