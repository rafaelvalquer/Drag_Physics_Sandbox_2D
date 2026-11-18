import type { BuildResult } from './buildCommon';
import type { ReliabilityLimits } from './EngineReliability';

/**
 * "Limitações do projeto": only bottlenecks that were MEASURED on the resolved build (fuel margin,
 * oil margin, internals torque margin, clutch capacity, compressor flow), each with its margin.
 * Nothing is listed because of the project's name.
 */
export interface Limitation {
  id: 'combustivel' | 'lubrificacao' | 'internos' | 'transmissao' | 'compressor' | 'giro';
  label: string;
  /** capacity / demand; < 1.1 is a bottleneck. */
  margin: number;
  detail: string;
}

export const LIMITATION_THRESHOLD = 1.1;

export function projectLimitations(b: BuildResult, limits?: ReliabilityLimits | null): Limitation[] {
  if (!b.ok) return [];
  const out: Limitation[] = [];
  const d = b.diagnostics;
  const pct = (m: number): string => `${Math.round(m * 100)} %`;
  if (d?.fuel) out.push({ id: 'combustivel', label: 'Alimentação', margin: d.fuel.margin, detail: `suporta ${Math.floor(d.fuel.supportCv)} cv de ${Math.ceil(d.fuel.peakPowerCv)} cv (${pct(d.fuel.margin)})` });
  if (d?.oil) out.push({ id: 'lubrificacao', label: 'Lubrificação', margin: d.oil.margin, detail: `${d.oil.limiter === 'bomba' ? 'bomba de óleo' : 'troca térmica'} cobre ${pct(d.oil.margin)}` });
  if (d?.internals) out.push({ id: 'internos', label: 'Internos', margin: d.internals.limitNm / d.internals.peakTorqueNm, detail: `${Math.round(d.internals.peakTorqueNm)} N·m de ${Math.round(d.internals.limitNm)} N·m` });
  const clutch = b.car.transmission.clutch.maxTorqueNm;
  out.push({ id: 'transmissao', label: 'Transmissão', margin: clutch / b.peakTorqueNm, detail: `${clutch} N·m de capacidade para ${Math.round(b.peakTorqueNm)} N·m` });
  if (d?.compressorFlowKgS) out.push({ id: 'compressor', label: 'Compressor', margin: 1, detail: `fluxo até ${d.compressorFlowKgS.toFixed(2).replace('.', ',')} kg/s` });
  if (limits) out.push({ id: 'giro', label: 'Giro', margin: (limits.maxSafeRpm - b.car.engine.revLimitRpm) / 500 + 1, detail: `corte ${b.car.engine.revLimitRpm} rpm, limite mecânico ${limits.maxSafeRpm} rpm` });
  return out.filter((l) => l.id !== 'compressor').sort((a, c) => a.margin - c.margin);
}

export const isBottleneck = (l: Limitation): boolean => l.margin < LIMITATION_THRESHOLD;
