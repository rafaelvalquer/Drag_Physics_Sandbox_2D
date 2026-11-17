import type { CarConfig } from '../../data/schema';
import { optimalShiftRpms } from '../ai/DragAI';
import type { Outcome, RunSummary } from './CareerState';

/**
 * Nina's race debrief: deterministic rules on the measured race data (no external AI). Each rule
 * reads one physical symptom of the run; the most important ones come first.
 */
export interface Comment {
  id: 'red-light' | 'dnf' | 'slow-reaction' | 'wheelspin' | 'bog' | 'clutch-slip' | 'late-shift' | 'early-shift' | 'good-launch-low-power' | 'clean-run';
  text: string;
}

export interface EvaluationInput {
  outcome: Outcome;
  player: RunSummary;
  opponent: RunSummary;
  playerCar: CarConfig;
  /** Peak power of both builds (cv). */
  playerPowerCv: number;
  opponentPowerCv: number;
}

const f1 = (v: number): string => v.toFixed(1).replace('.', ',');
/** RT (reaction + rollout) above which the launch was clearly slow. */
export const SLOW_RT_S = 1.0;
/** RT that counts as a sharp launch. */
export const SHARP_RT_S = 0.85;
const f2 = (v: number): string => v.toFixed(2).replace('.', ',');

export function evaluateRace(i: EvaluationInput): Comment[] {
  const p = i.player;
  const out: Comment[] = [];
  if (p.redLight) {
    out.push({ id: 'red-light', text: `Queimou a largada (${f2(p.rt ?? 0)} s). Espera o verde: largar antes não vale nada.` });
    return out;
  }
  if (p.dnf) {
    out.push({
      id: 'dnf',
      text:
        p.dnfReason === 'engine-blown'
          ? 'Quebrou o motor. Ficou tempo demais acima do giro que ele aguenta, com carga. Baixa o corte no Dyno Lab ou dá folga com molas de válvula e internos forjados.'
          : 'Não completou. Sem cruzar a linha não tem tempo nem prêmio.',
    });
    return out;
  }
  const car = i.playerCar;
  const spin = p.wheelspinS ?? 0;
  const slip = p.maxSlipRatio ?? 0;
  const launchTarget = car.transmission.clutch.launchRpm;
  // RT here is green → leaving the stage beam (reaction + rollout): ~0.75 s is a sharp launch in
  // these cars, so the comparison is against the game's scale and the rival's RT.
  const o = i.opponent;
  if ((p.rt ?? 0) > SLOW_RT_S || (p.rt !== null && o.rt !== null && p.rt > o.rt + 0.12)) out.push({ id: 'slow-reaction', text: `Tempo de reação de ${f2(p.rt!)} s. Isso é carro de vantagem para o outro lado.` });
  if (spin > 0.8 || slip > 0.45)
    out.push({
      id: 'wheelspin',
      text: `As rodas patinaram ${f1(spin)} s (pico de ${Math.round(slip * 100)} % de escorregamento). Dosa o acelerador na saída ou põe pneu melhor.`,
    });
  if (p.launchRpm !== undefined && p.launchRpm > 0 && p.launchRpm < launchTarget * 0.7 && spin < 0.3)
    out.push({ id: 'bog', text: `Saiu com ${Math.round(p.launchRpm)} rpm: o motor afogou. Segura o pé no fundo antes de soltar.` });
  // with heavy wheelspin the clutch logic relaxes the clamp on purpose: that is not the disc
  if ((p.clutchSlipS ?? 0) > 0.5 && spin < 0.8)
    out.push({
      id: 'clutch-slip',
      text: `A embreagem patinou ${f1(p.clutchSlipS!)} s nas trocas. O disco não está segurando o torque.`,
    });
  const shifts = p.shiftRpms ?? [];
  if (shifts.length) {
    const opt = optimalShiftRpms(car);
    const limit = car.engine.revLimitRpm;
    const late = shifts.filter((r) => r >= limit - 120).length;
    const early = shifts.filter((r, k) => opt[k] !== undefined && r < opt[k]! - 700).length;
    if (late) out.push({ id: 'late-shift', text: `Bateu no corte em ${late} troca${late > 1 ? 's' : ''}. No limitador o carro para de acelerar.` });
    else if (early)
      out.push({
        id: 'early-shift',
        text: `Trocou cedo ${early} vez${early > 1 ? 'es' : ''}. Este motor ainda empurra até perto de ${Math.round(opt[0]! / 100) * 100} rpm.`,
      });
  }
  if (i.outcome === 'loss' && out.length === 0 && (p.rt ?? 9) < SHARP_RT_S && i.opponentPowerCv > i.playerPowerCv * 1.12)
    out.push({
      id: 'good-launch-low-power',
      text: `Largada boa. O que faltou foi motor: ${Math.round(i.playerPowerCv)} cv contra ${Math.round(i.opponentPowerCv)} cv.`,
    });
  if (out.length === 0)
    out.push({ id: 'clean-run', text: i.outcome === 'win' ? 'Corrida limpa. É assim que se faz.' : 'Corrida limpa. Agora é acerto de carro.' });
  return out.slice(0, 3);
}
