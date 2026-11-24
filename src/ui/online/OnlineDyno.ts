import { findCampaignCar } from '../../data/cars/campaign';
import { resolveBuild, type BuildTune } from '../../game/career/tuning/BuildResolver';
import { nitrousKitOf, nitrousLimits, nitrousTuneOf } from '../../game/career/tuning/nitrousOverlay';
import { TUNE_LABEL, tuningCapabilities, type RangeControl } from '../../game/career/tuning/TuningCapabilities';
import type { Garage } from '../../game/online/OnlineClient';
import { EngineDyno, type DynoPoint } from '../../physics/engine/EngineDyno';
import { drawLineChart } from '../charts';
import { h } from '../dom';

export function onlineDyno(car: Garage['cars'][number], save: (tune: BuildTune) => Promise<void>): HTMLElement {
  const factory = findCampaignCar(car.base_car_id)!;
  const caps = tuningCapabilities(factory, car.parts, car.build_version, { tunersUnlocked: true, exactBoostMax: true });
  const tune = { ...car.tune };
  const kit = nitrousKitOf(car.parts);
  const status = h('p', { role: 'status' });
  const chart = h('canvas', { class: 'online-dyno-chart', 'aria-label': 'Curvas de potência e torque' });
  const numerical = (field: keyof BuildTune, control: RangeControl): HTMLElement => {
    const input = h('input', { type: 'number', min: control.min, max: control.max, step: control.step, disabled: !control.enabled,
      value: typeof tune[field] === 'number' ? tune[field] : control.default, onchange: (event) => {
        const value = (event.target as HTMLInputElement).valueAsNumber;
        if (Number.isFinite(value)) Object.assign(tune, { [field]: value });
        else delete tune[field];
      } });
    return h('label', { title: control.reason }, TUNE_LABEL[field], input);
  };
  const preset = <T extends 'throttleResponse' | 'finalDrive'>(field: T, control: typeof caps.throttle | typeof caps.finalDrive): HTMLElement =>
    h('label', { title: control.reason }, TUNE_LABEL[field], h('select', { disabled: !control.enabled,
      onchange: (event) => Object.assign(tune, { [field]: (event.target as HTMLSelectElement).value }),
    }, control.options.map((option) => h('option', { value: option.value, selected: (tune[field] ?? control.default) === option.value }, option.label))));
  let before: DynoPoint[] | undefined;
  const measure = (engine: typeof car.config.engine) => {
    const bench = new EngineDyno(engine);
    if (!bench.start()) throw new Error('O motor não ligou no dinamômetro.');
    return bench.sweep(Math.ceil(engine.idleRpm / 500) * 500, engine.redlineRpm, 500);
  };
  const run = h('button', { onclick: () => {
    run.disabled = true;
    status.textContent = 'Medindo no dinamômetro…';
    setTimeout(() => {
      try {
        const build = resolveBuild(factory, car.parts, tune, car.build_version);
        if (!build.ok) throw new Error(build.errors.join('. '));
        before ??= measure(car.config.engine);
        const after = measure(build.car.engine);
        const peakPower = Math.max(...after.map((point) => point.powerCv));
        const peakTorque = Math.max(...after.map((point) => point.torqueNm));
        drawLineChart(chart, [
          { label: 'Potência salva', color: '#ffb24a', dashed: true, x: before.map((p) => p.rpm), y: before.map((p) => p.powerCv) },
          { label: 'Torque salvo', color: '#68d5ff', dashed: true, right: true, x: before.map((p) => p.rpm), y: before.map((p) => p.torqueNm) },
          { label: 'Potência medida', color: '#ffb24a', x: after.map((p) => p.rpm), y: after.map((p) => p.powerCv) },
          { label: 'Torque medido', color: '#68d5ff', right: true, x: after.map((p) => p.rpm), y: after.map((p) => p.torqueNm) },
        ], { xLabel: 'rpm', yLabel: 'cv', yRightLabel: 'N·m' });
        status.textContent = `${peakPower.toFixed(1)} cv · ${peakTorque.toFixed(1)} N·m`;
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Medição indisponível.';
      } finally { run.disabled = false; }
    }, 0);
  } }, 'Medir e comparar');
  const nitrous = kit ? (() => {
    const range = nitrousLimits(kit);
    const defaults = nitrousTuneOf(kit, {});
    return [
      numerical('nitrousFlow', { enabled: true, reason: null, min: range.flowMin, max: range.flowMax, step: 0.01, default: defaults.flow }),
      numerical('nitrousRampS', { enabled: true, reason: null, min: 0, max: range.rampMax, step: 0.01, default: defaults.rampS }),
    ];
  })() : [];
  return h('section', { class: 'online-card' }, h('h2', {}, car.config.name),
    h('form', { onsubmit: (event) => { event.preventDefault(); void save(tune); } },
      h('div', { class: 'online-filters' }, [
        numerical('boostBar', caps.boost), numerical('revLimitRpm', caps.revLimit), numerical('launchRpm', caps.launch),
        numerical('shiftRpm', caps.shift), numerical('tirePressureKpa', caps.tirePressure),
        preset('throttleResponse', caps.throttle), preset('finalDrive', caps.finalDrive), ...nitrous,
      ]),
      h('div', { class: 'row' }, h('button', { type: 'submit', class: 'primary' }, 'Salvar acerto'))),
    run, status, chart);
}
