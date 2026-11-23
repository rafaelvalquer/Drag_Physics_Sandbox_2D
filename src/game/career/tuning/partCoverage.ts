import type { CarConfig } from '../../../data/schema';
import { LEGACY_FAMILY, CATEGORY_ORDER, type PartCategory } from './parts';
import { familyOf, transmissionKindOf } from './BuildResolverV2';
import { physicalSlotOfCategory } from './partProgression';

export const WORKSHOP_SLOTS = [...new Set(CATEGORY_ORDER.map(physicalSlotOfCategory))];

/** Assess applicability independently of whether the catalog happens to cover the slot. */
export function workshopSlotExclusion(car: CarConfig, slot: PartCategory): string | null {
  const transmission = transmissionKindOf(car);
  if (slot === 'nitrous') return 'Kits de N₂O têm quatro portes próprios e ganho só enquanto injetam; ficam fora das sequências de três estágios.';
  if (slot === 'awd' && car.drivenAxle !== 'awd') return 'Veículo sem tração integral.';
  if ((slot === 'engine-flywheel' || slot === 'clutch') && transmission !== 'manual')
    return 'Componente de câmbio manual. A preparação compatível pertence ao slot do câmbio.';
  if (slot === 'electronics-launch' && transmission === 'torque-converter-auto')
    return 'Na largada, o conversor determina o estol.';
  if (slot === 'turbo' && car.engine.induction === 'turbo')
    return 'Turbo de fábrica. O upgrade pertence ao slot da turbina.';
  if (slot === 'turbo' && car.engine.family === 'toyota-2gr-fse')
    return 'Conversão opcional sem calibração do sistema de injeção mista e do conversor sob pressão.';
  if (slot === 'exhaust-downpipe' && car.engine.induction !== 'turbo')
    return 'Sem saída de turbina de fábrica. Em conversões a saída faz parte do kit.';
  if (familyOf(car) !== LEGACY_FAMILY && car.engine.induction !== 'turbo' &&
    ['turbo-turbine', 'turbo-intercooler', 'turbo-wastegate', 'turbo-boost'].includes(slot))
    return 'Sem turbo de fábrica. Componentes dependem de um projeto de conversão.';
  return null;
}
