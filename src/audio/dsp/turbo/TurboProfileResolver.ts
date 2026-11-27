/**
 * Turbo Acoustics 2.0 — profile resolver.
 *
 *   base profile (engine family / kit class)
 *   + family patch
 *   + installed turbo (kit, stage, turbine size)
 *   + intake path
 *   + valve type (from the resolved physics config: bovEnabled / bovVent)
 *   + wastegate topology (hardware hints)
 *   + twin layout (from the resolved physics config)
 *   = final acoustic signature
 *
 * Pure and deterministic: the same resolved car gives the same signature in every game mode
 * (campaign, Sandbox, free race, dyno, multiplayer), because all inputs come from the resolved
 * CarConfig that every mode already shares.
 */
import type { TurboConfig } from '../../../data/schema';
import { BASE_TURBO_PROFILES, FAMILY_ACOUSTICS, patchProfile, type FamilyAcoustics } from './TurboAcousticProfiles';
import type { BovVentType, IntakePath, ResolvedTurboProfile, TurboAcousticHints, TurboProfileId, TurboProfilePatch, WastegateType } from './TurboAcousticTypes';

export interface TurboResolverInput {
  engineId: string;
  family?: string;
  turbo: TurboConfig;
  hints?: TurboAcousticHints;
}

/** Default exposure of each intake path (0 = stock airbox … 1 = open inlet). */
export const INTAKE_EXPOSURE: Readonly<Record<IntakePath, number>> = { airbox: 0, 'sport-element': 0.25, cone: 0.65, open: 0.9 };

/** Reference charge-air volume (L) for the intercooler resonance shift. */
const CHARGE_VOLUME_REF_L = 3;

export function familyAcousticsOf(engineId: string, family?: string): { key: string; entry: FamilyAcoustics } | undefined {
  if (family && FAMILY_ACOUSTICS[family]) return { key: family, entry: FAMILY_ACOUSTICS[family]! };
  // engine-id prefixes (classic and sandbox engines): longest match wins
  let best: string | undefined;
  for (const k of Object.keys(FAMILY_ACOUSTICS)) if (engineId.startsWith(k) && (!best || k.length > best.length)) best = k;
  return best ? { key: best, entry: FAMILY_ACOUSTICS[best]! } : undefined;
}

function classicKitProfile(kit: TurboAcousticHints['kit']): TurboProfileId {
  return kit === 'strong' ? 'classic-large-turbo' : kit === 'medium' ? 'classic-medium-turbo' : 'classic-small-turbo';
}

/** Turbine (rotor) option of the classic kits: relative tweaks, never the frequency itself. */
const TURBINE_PATCH: Readonly<Record<NonNullable<TurboAcousticHints['turbine']>, (b: ResolvedTurboProfile) => TurboProfilePatch>> = {
  small: (b) => ({ rotor: { onsetShaft: b.rotor.onsetShaft * 0.9, spoolEmphasis: Math.min(1, b.rotor.spoolEmphasis + 0.05), bladePassGain: b.rotor.bladePassGain * 1.05 }, compressor: { bodyGain: b.compressor.bodyGain * 0.95 } }),
  medium: (b) => ({ rotor: { onsetShaft: b.rotor.onsetShaft * 1.05 } }),
  'medium-high': (b) => ({ rotor: { onsetShaft: b.rotor.onsetShaft * 1.1, order2Gain: b.rotor.order2Gain * 1.04 }, compressor: { bodyGain: b.compressor.bodyGain * 1.05 } }),
  large: (b) => ({
    rotor: { onsetShaft: b.rotor.onsetShaft * 1.18, order2Gain: b.rotor.order2Gain * 1.08, spoolEmphasis: Math.min(1, b.rotor.spoolEmphasis + 0.08) },
    compressor: { bodyGain: b.compressor.bodyGain * 1.1, spectralTilt: b.compressor.spectralTilt - 0.08 },
    flutter: { basePulseRateHz: b.flutter.basePulseRateHz * 0.9, damping: Math.min(0.9, b.flutter.damping + 0.02) },
  }),
};

export function resolveTurboProfile(input: TurboResolverInput): ResolvedTurboProfile {
  const { turbo, hints = {} } = input;
  const fam = familyAcousticsOf(input.engineId, input.family);
  const twin = turbo.layout === 'parallel-twin';
  const chain: string[] = [];
  // ---- base profile
  let baseId: TurboProfileId;
  if (hints.profile && hints.profile in BASE_TURBO_PROFILES) {
    baseId = hints.profile as TurboProfileId;
    chain.push(`perfil forçado: ${baseId}`);
  } else if (hints.kit === 'conversion') {
    baseId = fam?.entry.conversion ?? 'modern-na-conversion';
    chain.push(`conversão (${fam?.entry.label ?? input.engineId})`);
  } else if (fam?.entry.factory) {
    const stage = hints.stage ?? 0;
    baseId = stage >= 2 && fam.entry.upgraded ? fam.entry.upgraded[stage >= 3 ? 1 : 0] : fam.entry.factory;
    chain.push(`turbo de fábrica ${fam.entry.label}${stage ? ` Stage ${stage}` : ''}`);
  } else if (hints.kit || (fam && !fam.entry.conversion)) {
    // classic aftermarket kit (a classic build without hints is the basic kit of the game)
    baseId = classicKitProfile(hints.kit);
    chain.push(`kit ${hints.kit} (${fam?.entry.label ?? input.engineId})`);
  } else {
    // a turbo without family data (editor / lab): pick the class from the rotor itself
    baseId = twin ? 'v6-parallel-twin-oem' : turbo.maxShaftRpm >= 200000 ? 'modern-small-oem' : turbo.maxShaftRpm >= 170000 ? 'classic-medium-turbo' : 'classic-large-turbo';
    chain.push(`sem família: classe pelo rotor (${Math.round(turbo.maxShaftRpm / 1000)} krpm)`);
  }
  chain.push(`base ${baseId}`);
  const vent: BovVentType = !turbo.bovEnabled ? 'none' : turbo.bovVent === 'recirculating' ? 'recirculating' : 'atmosphere';
  const intakePath: IntakePath = hints.intake ?? 'airbox';
  const wastegateType: WastegateType = hints.wastegate ?? 'internal';
  let r: ResolvedTurboProfile = {
    ...BASE_TURBO_PROFILES[baseId],
    baseId,
    chain,
    ventType: vent,
    wastegateType,
    intakePath,
    intakeExposure: hints.intakeExposure ?? INTAKE_EXPOSURE[intakePath],
    chargeVolumeAddL: Math.max(0, hints.chargeVolumeAddL ?? 0),
    twin,
    blades: turbo.compressorBlades,
    maxShaftRpm: turbo.maxShaftRpm,
    maxBoostPa: turbo.maxBoostBar * 1e5,
    bovVentTimeS: turbo.bovVentTimeS,
  };
  // ---- family patch
  if (fam?.entry.patch) {
    r = patchProfile(r, fam.entry.patch);
    chain.push(`família ${fam.key}`);
  }
  // ---- stage 1 factory upgrade: same compressor class, a little more work
  if ((hints.stage ?? 0) === 1 && hints.kit !== 'conversion' && fam?.entry.factory) {
    r = patchProfile(r, { rotor: { level: r.rotor.level * 1.05, bladePassGain: r.rotor.bladePassGain * 1.05 } });
    chain.push('Stage 1');
  }
  // ---- classic kit "street": the basic kit's turbine with a larger housing
  if (hints.kit === 'street') {
    r = patchProfile(r, { rotor: { level: r.rotor.level * 1.04, onsetShaft: r.rotor.onsetShaft * 1.06 } });
    chain.push('kit street');
  }
  // ---- turbine option
  if (hints.turbine) {
    r = patchProfile(r, TURBINE_PATCH[hints.turbine](r));
    chain.push(`turbina ${hints.turbine}`);
  }
  // ---- intake path: an open inlet exposes the compressor tones and the BOV recirculation
  const exposure = Math.min(1, Math.max(0, r.intakeExposure));
  r = patchProfile(r, { intakeAttenuation: r.intakeAttenuation * (1 - exposure) });
  if (intakePath !== 'airbox') chain.push(`admissão ${intakePath}`);
  // ---- charge volume (intercooler / piping): Helmholtz-like shift f ∝ 1/√V of the duct resonances
  if (r.chargeVolumeAddL > 0) {
    const k = Math.sqrt(CHARGE_VOLUME_REF_L / (CHARGE_VOLUME_REF_L + r.chargeVolumeAddL));
    r = patchProfile(r, { resonance: r.resonance.map((x) => ({ ...x, frequencyHz: x.frequencyHz * k })) });
    chain.push(`volume de pressurização +${r.chargeVolumeAddL.toFixed(1)} L`);
  }
  if (vent !== 'atmosphere') chain.push(vent === 'recirculating' ? 'válvula recirculante' : 'sem válvula de alívio');
  if (wastegateType !== 'internal') chain.push(`wastegate ${wastegateType}`);
  if (twin) chain.push('biturbo paralelo (2 rotores)');
  else if (r.housing === 'twin-scroll') chain.push('twin-scroll (1 rotor)');
  return r;
}
