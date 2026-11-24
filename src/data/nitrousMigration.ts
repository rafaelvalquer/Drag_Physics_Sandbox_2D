const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Converts legacy tune fields at the storage boundary, leaving other settings intact. */
export function migrateNitrousTune(input: unknown, rampMax = 3): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const { nitrousMode, nitrousShare, nitrousFlow1, nitrousRamp1, nitrousFlow2, nitrousRamp2, ...tune } =
    input as Record<string, unknown>;
  const dual = nitrousMode === 'dual';
  const share = dual ? clamp(numberOr(nitrousShare, 0.5), 0.2, 0.8) : 1;
  if (tune.nitrousFlow === undefined && (dual || nitrousFlow1 !== undefined)) {
    tune.nitrousFlow = clamp(share * numberOr(nitrousFlow1, 0.7) + (1 - share) * numberOr(nitrousFlow2, 0.5), 0.25, 1);
  }
  if (tune.nitrousRampS === undefined && (dual || nitrousRamp1 !== undefined)) {
    const first = clamp(numberOr(nitrousRamp1, 0.3), 0, rampMax);
    const second = clamp(numberOr(nitrousRamp2, 1), 0, rampMax);
    tune.nitrousRampS = share * first + (1 - share) * second;
  }
  return tune;
}

/** Sandbox presets persist resolved car configurations rather than a workshop tune. */
export function migrateNitrousConfig(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const { mode, stage1Share, stage1Flow, stage1RampS, stage2Flow, stage2RampS, ...setup } =
    input as Record<string, unknown>;
  if (mode === undefined && stage1Flow === undefined) return input;
  const tune = migrateNitrousTune({
    nitrousMode: mode, nitrousShare: stage1Share, nitrousFlow1: stage1Flow, nitrousRamp1: stage1RampS,
    nitrousFlow2: stage2Flow, nitrousRamp2: stage2RampS,
  }) as { nitrousFlow?: number; nitrousRampS?: number };
  return { ...setup, flow: setup.flow ?? tune.nitrousFlow ?? 0.7, rampS: setup.rampS ?? tune.nitrousRampS ?? 0.3 };
}
