import { radSToRpm } from '../core/units';
import type { VehicleSimulation } from '../physics/vehicle/VehicleSimulation';

export interface Channel {
  id: string;
  label: string;
  unit: string;
  get: (s: VehicleSimulation) => number;
}

/** Recorded channels (one sample per physics step). */
export const CHANNELS: Channel[] = [
  { id: 't', label: 'tempo', unit: 's', get: (s) => s.simTime },
  { id: 'x', label: 'distância', unit: 'm', get: (s) => s.x },
  { id: 'v', label: 'velocidade', unit: 'm/s', get: (s) => s.speed },
  { id: 'a', label: 'aceleração', unit: 'm/s²', get: (s) => s.telemetry.acceleration },
  { id: 'rpm', label: 'rpm motor', unit: 'rpm', get: (s) => s.engine.rpm },
  { id: 'pedal', label: 'acelerador', unit: '0..1', get: (s) => s.controls.pedal },
  { id: 'throttle', label: 'borboleta efetiva', unit: '0..1', get: (s) => s.engine.throttleEffective },
  { id: 'map', label: 'pressão coletor', unit: 'kPa', get: (s) => s.engine.manifoldPressure / 1000 },
  { id: 'boost', label: 'pressão turbo', unit: 'kPa', get: (s) => (s.engine.turbo ? s.engine.turbo.boostPa / 1000 : 0) },
  { id: 'tq', label: 'torque líquido', unit: 'N·m', get: (s) => s.engine.torqueNetLast },
  { id: 'gear', label: 'marcha', unit: '', get: (s) => (s.gearbox.engaged ? s.gearbox.gear : 0) },
  { id: 'clutch', label: 'embreagem (cmd)', unit: '0..1', get: (s) => s.clutchCtl.engagement },
  { id: 'clutchTq', label: 'torque embreagem', unit: 'N·m', get: (s) => s.clutchTorque },
  { id: 'slipClutch', label: 'deslize embreagem', unit: 'rpm', get: (s) => radSToRpm(s.telemetry.clutchSlip) },
  { id: 'slip', label: 'deslizamento pneu', unit: '', get: (s) => s.telemetry.slipRatio },
  { id: 'Fx', label: 'força pneu', unit: 'N', get: (s) => s.tireForce },
  { id: 'Fz', label: 'carga eixo motriz', unit: 'N', get: (s) => s.telemetry.normalLoadDriven },
  { id: 'drag', label: 'arrasto', unit: 'N', get: (s) => s.dragForce },
  { id: 'pitch', label: 'arfagem', unit: 'rad', get: (s) => s.pitch },
  { id: 'shift', label: 'estado troca', unit: 'enum', get: (s) => SHIFT_CODES[s.shift.state] ?? -1 },
  { id: 'egt', label: 'temp. escape', unit: 'K', get: (s) => s.engine.exhaustTempK },
  { id: 'nitroActive', label: 'N₂O injetando', unit: '0..1', get: (s) => Number(s.nitrous?.active ?? false) },
  { id: 'nitroFlow', label: 'N₂O vazão', unit: 'g/s', get: (s) => (s.nitrous?.telemetry().flowKgPerS ?? 0) * 1000 },
  { id: 'nitroTq', label: 'N₂O torque extra', unit: 'N·m', get: (s) => s.nitrous?.telemetry().additionalTorqueNm ?? 0 },
  { id: 'nitroLeft', label: 'N₂O restante', unit: '0..1', get: (s) => s.nitrous?.telemetry().remainingFraction ?? 0 },
];

const SHIFT_CODES: Record<string, number> = { IDLE: 0, TORQUE_CUT: 1, CLUTCH_DISENGAGE: 2, GEAR_CHANGE: 3, REV_MATCH: 4, CLUTCH_ENGAGE: 5, COMPLETE: 6 };

/**
 * Records the physics state at every fixed step into preallocated column buffers and exports CSV.
 * The CSV header states exactly what was recorded: the physics rate, the number of samples, any
 * samples lost because the buffer was full, and the real time the loop could not simulate.
 */
export class TelemetryRecorder {
  private readonly cols: Float64Array[];
  count = 0;
  lost = 0;
  recording = false;
  meta: Record<string, string> = {};

  constructor(readonly capacity = 120 * 120) {
    this.cols = CHANNELS.map(() => new Float64Array(capacity));
  }

  start(meta: Record<string, string>): void {
    this.count = 0;
    this.lost = 0;
    this.meta = meta;
    this.recording = true;
  }

  stop(): void {
    this.recording = false;
  }

  sample(s: VehicleSimulation): void {
    if (!this.recording) return;
    if (this.count >= this.capacity) {
      this.lost++;
      return;
    }
    const i = this.count++;
    for (let k = 0; k < CHANNELS.length; k++) this.cols[k]![i] = CHANNELS[k]!.get(s);
  }

  column(id: string): Float64Array | null {
    const k = CHANNELS.findIndex((c) => c.id === id);
    return k >= 0 ? this.cols[k]!.subarray(0, this.count) : null;
  }

  toCsv(extraNotes: string[] = []): string {
    const lines: string[] = [];
    lines.push('# Drag Physics Sandbox 2D - telemetria');
    for (const [k, v] of Object.entries(this.meta)) lines.push(`# ${k}: ${v}`);
    lines.push(`# amostras: ${this.count} (1 por passo de física, dt = 1/120 s)`);
    lines.push(`# amostras perdidas (buffer cheio): ${this.lost}`);
    for (const n of extraNotes) lines.push(`# ${n}`);
    lines.push(CHANNELS.map((c) => (c.unit ? `${c.id} [${c.unit}]` : c.id)).join(','));
    for (let i = 0; i < this.count; i++) {
      const row: string[] = [];
      for (let k = 0; k < CHANNELS.length; k++) {
        const v = this.cols[k]![i]!;
        row.push(Number.isInteger(v) ? String(v) : v.toPrecision(7));
      }
      lines.push(row.join(','));
    }
    return lines.join('\n') + '\n';
  }
}
