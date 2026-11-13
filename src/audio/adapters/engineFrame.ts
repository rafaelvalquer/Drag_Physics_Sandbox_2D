import { AF } from '../../core/contracts';
import type { EngineModel } from '../../physics/engine/EngineModel';

/**
 * Builds the audio control frame of an engine that is not in a vehicle (engine dynamometer).
 * Vehicle fields (speed, tyres, gearbox) are zero; the engine fields are the same ones the vehicle
 * simulation writes, so the dyno sound is the same acoustic model as on the track.
 */
export function fillEngineAudioFrame(frame: Float64Array, e: EngineModel, simTime: number, sparkCut = 0): Float64Array {
  frame.fill(0);
  frame[AF.simTime] = simTime;
  frame[AF.omega] = e.crank.v;
  frame[AF.crankAngle] = e.cycleAngle;
  frame[AF.throttle] = e.throttleEffective;
  frame[AF.load] = e.load;
  frame[AF.manifoldPressure] = e.manifoldPressure;
  frame[AF.boostPressure] = e.turbo ? e.turbo.boostPa : 0;
  frame[AF.combustionEnabled] = e.combustionEnabled && !e.ignition.limiterActive ? 1 : 0;
  frame[AF.sparkCut] = sparkCut;
  frame[AF.revLimiter] = e.ignition.limiterActive ? 1 : 0;
  frame[AF.exhaustTempK] = e.exhaustTempK;
  frame[AF.turboShaftRpm] = e.turbo ? e.turbo.shaftRpm : 0;
  frame[AF.bovFlow] = e.turbo ? e.turbo.bovFlow : 0;
  frame[AF.torqueNet] = e.torqueNetLast;
  frame[AF.starterActive] = e.starterRow.enabled ? 1 : 0;
  frame[AF.afterfire] = e.afterfire ? 1 : 0;
  return frame;
}
