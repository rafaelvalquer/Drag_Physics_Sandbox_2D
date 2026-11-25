import type { AppContext } from '../../app/Mode';
import { END_FADE_LEVEL, VehicleSound } from '../../audio/core/VehicleSound';
import { carToAcousticConfig } from '../../audio/dsp/AcousticConfig';
import { AF } from '../../core/contracts';
import type { TrackConfig } from '../../data/schema';
import { Hud } from '../../ui/Hud';
import { PHYSICS_DT } from '../SimulationRunner';
import { RACE_DISTANCES } from '../race/RaceController';
import type { RenderVehicle, TreeLights } from '../scenes/renderTypes';
import type { OnlineGearUpdate, OnlineLaneSnapshot, OnlineLoadingState, OnlineRaceSnapshot } from './contracts';

const lerp = (from: number, to: number, alpha: number) => from + (to - from) * alpha;

/** Presents interpolated server telemetry through the normal scene and audio worklets. */
export class OnlineRaceRenderer {
  private previous?: OnlineRaceSnapshot;
  private current?: OnlineRaceSnapshot;
  private arrivedAt = 0;
  private readonly voices: (VehicleSound | undefined)[] = [];
  private readonly hud: Hud;
  private renderList: RenderVehicle[] = [];
  private displayedLights: TreeLights | null = null;
  private audioTick = 0;
  private estimatedTick = 0;
  private latestGear?: OnlineGearUpdate;
  serverClockOffsetMs?: number;

  constructor(private readonly ctx: AppContext, readonly loading: OnlineLoadingState, private readonly track: TrackConfig) {
    this.hud = new Hud(ctx.hud);
    this.onAudioReady();
  }

  get newest(): OnlineRaceSnapshot | undefined { return this.current; }

  receive(snapshot: OnlineRaceSnapshot): void {
    if (snapshot.matchId !== this.loading.matchId || (this.current && snapshot.tick <= this.current.tick)) return;
    this.previous = this.current ?? snapshot;
    this.current = snapshot;
    this.arrivedAt = performance.now();
  }

  receiveGear(update: OnlineGearUpdate): void {
    if (update.matchId !== this.loading.matchId || update.tick <= (this.latestGear?.tick ?? -1)) return;
    this.latestGear = update;
  }

  tick(dt: number): void {
    const current = this.current;
    if (!current || !this.previous) return;
    const previous = this.previous;
    const interval = Math.max(1, current.tick - previous.tick);
    const secondsSinceArrival = (performance.now() - this.arrivedAt) / 1_000;
    const alpha = Math.min(1, secondsSinceArrival / (PHYSICS_DT * interval));
    this.renderList = ([0, 1] as const).map((lane) => this.renderLane(lane, previous.lanes[lane], current.lanes[lane], alpha));
    const local = this.loading.lane;
    const me = this.renderList[local]!;
    const foe = this.renderList[1 - local]!;
    const telemetry = current.lanes[local];
    const gear = this.latestGear && this.latestGear.tick > current.tick ? this.latestGear : telemetry;
    const serverElapsed = current.sentAt !== undefined && this.serverClockOffsetMs !== undefined
      ? Math.max(0, (performance.now() + this.serverClockOffsetMs - current.sentAt) / 1_000)
      : secondsSinceArrival;
    this.estimatedTick = Math.max(this.estimatedTick, current.tick + Math.min(40, serverElapsed / PHYSICS_DT));
    const predictedTick = this.estimatedTick;
    const greenTick = current.scheduledGreenTick;
    const sinceGreen = greenTick === null ? null : Math.max(0, (predictedTick - greenTick) * PHYSICS_DT);
    const turbo = me.car.engine.turbo;
    this.hud.updateNetwork({ car: me.car, rpm: me.rpm, gear: gear.gear, targetGear: gear.targetGear,
      shifting: gear.shifting, limiter: telemetry.audioFrame[AF.revLimiter] > 0, speed: me.speed, pedal: this.ctx.input.pedal,
      slipRatio: me.slipRatio, turbo: { visible: !!turbo, boostBar: Math.max(0, telemetry.boostBar), maxBoostBar: turbo?.maxBoostBar ?? 0 } },
    this.ctx.settings.units, telemetry.result.redLight ? 'QUEIMOU A LARGADA' : me.blown ? 'MOTOR QUEBRADO' : '', {
      distanceM: me.x, timeS: telemetry.result.total ?? sinceGreen, etS: telemetry.result.et,
      alert: telemetry.result.redLight, gapM: foe.x - me.x, totalM: RACE_DISTANCES.quarter.m,
    });
    this.displayedLights = current.lights;
    if (greenTick !== null && predictedTick >= greenTick - 48) {
      const green = predictedTick >= greenTick;
      this.displayedLights = {
        ...current.lights,
        green: [green && !current.lights.red[0], green && !current.lights.red[1]],
        amber: [green ? 0 : 3, green ? 0 : 3],
      };
    }
    this.audio(previous, current, Math.floor(lerp(previous.tick, current.tick, alpha)), dt);
  }

  vehicles(): RenderVehicle[] { return this.renderList; }
  lights(): TreeLights | null { return this.displayedLights; }

  onAudioReady(): void {
    if (!this.ctx.audio.running) return;
    this.loading.cars.forEach((car, lane) => {
      if (this.voices[lane]) return;
      const quality = lane === this.loading.lane || !this.ctx.settings.opponentLowQuality ? this.ctx.settings.audioQuality : 'low';
      try {
        this.voices[lane] = new VehicleSound(this.ctx.audio, carToAcousticConfig(car, quality, 61 + lane), `online-${lane}`, 0.07, this.track.ambientTempC + 273.15);
      } catch (error) {
        console.warn('Áudio online indisponível', error);
      }
    });
  }

  dispose(): void {
    this.hud.dispose();
    this.voices.forEach((voice) => voice?.dispose());
  }

  private renderLane(lane: 0 | 1, previous: OnlineLaneSnapshot, current: OnlineLaneSnapshot, alpha: number): RenderVehicle {
    const { cars, names, matchId } = this.loading;
    return {
      id: `${matchId}-${lane}`, artKey: `${matchId}-${lane}`, car: cars[lane], lane, name: names[lane],
      isPlayer: lane === this.loading.lane, x: lerp(previous.x, current.x, alpha), physicsX: current.x,
      interpAlpha: alpha, physicsSteps: 0, pitch: lerp(previous.pitch, current.pitch, alpha),
      wheelAngleDriven: lerp(previous.wheelAngleDriven, current.wheelAngleDriven, alpha),
      wheelAngleFree: lerp(previous.wheelAngleFree, current.wheelAngleFree, alpha),
      speed: lerp(previous.speed, current.speed, alpha), rpm: lerp(previous.rpm, current.rpm, alpha),
      wheelOmegaDriven: current.wheelOmegaDriven, wheelOmegaFree: current.wheelOmegaFree,
      slipSpeed: current.audioFrame[AF.wheelSlipSpeed] ?? 0, slipRatio: current.slipRatio, accel: current.accel,
      afterfire: !!current.audioFrame[AF.afterfire], running: current.runState === 'RUNNING', cranking: current.runState === 'CRANKING',
      blown: current.runState === 'BROKEN', load: current.audioFrame[AF.load] ?? 0, braking: current.braking,
      shifting: current.shifting, nitrous: current.nitrous,
    };
  }

  private audio(previous: OnlineRaceSnapshot, current: OnlineRaceSnapshot, renderTick: number, dt: number): void {
    const start = Math.max(this.audioTick + 1, previous.tick, renderTick - 12);
    this.audioTick = Math.max(this.audioTick, renderTick);
    this.voices.forEach((voice, index) => {
      if (!voice) return;
      const lane = index as 0 | 1;
      const a = previous.lanes[lane].audioFrame;
      const b = current.lanes[lane].audioFrame;
      if (a.length !== AF.length || b.length !== AF.length) return;
      const frame = new Float64Array(AF.length);
      for (let tick = start; tick <= renderTick; tick++) {
        const alpha = (tick - previous.tick) / Math.max(1, current.tick - previous.tick);
        for (let channel = 0; channel < AF.length; channel++) frame[channel] = lerp(a[channel]!, b[channel]!, alpha);
        for (const channel of [AF.crankAngle, AF.revLimiter, AF.combustionEnabled, AF.starterActive, AF.gear, AF.afterfire]) {
          frame[channel] = (alpha < 0.5 ? a : b)[channel]!;
        }
        voice.pushFrame(frame);
      }
      const car = this.renderList[lane]!;
      const player = this.renderList[this.loading.lane]!;
      voice.setSpatial(car.x - player.x, Math.hypot(car.x - player.x, lane === this.loading.lane ? 2 : 5), dt);
      voice.setFade(current.phase === 'finished' ? END_FADE_LEVEL : 1);
      voice.syncNitrous(current.lanes[lane].nitrous > 0 ? 'INJECTING' : 'READY', current.lanes[lane].nitrous);
      voice.flush();
    });
  }
}
