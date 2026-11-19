import type { CarConfig } from '../../data/schema';
import { engineGeometry } from '../../physics/engine/EngineGeometry';
import { clear, h } from '../dom';
import { GarageVehiclePreview } from './GarageVehiclePreview';

/**
 * Garage: a large studio preview of each car (the same artwork as on the track), a visual car
 * picker, the technical sheet read from the car's real configuration and a paint preview.
 */
type Paint = { color: string; accent: string };

export type GarageOptions = {
  cars: readonly CarConfig[];
  current: CarConfig | null;
  /** Label of the button that applies the choice (depends on the active mode). */
  useLabel: string;
} & (
  | { onUse(carId: string, paint: Paint | null): void; purchase?: never }
  | {
    purchase: {
      confirm(carId: string, paint: Paint | null): Promise<string | null>;
      onPurchased(): void;
    };
    onUse?: never;
  }
);

/** Paint choices offered in the garage (the car's own colour is always the first). */
export const PAINTS: { name: string; color: string; accent: string }[] = [
  { name: 'vermelho', color: '#c62828', accent: '#1c1c1c' },
  { name: 'azul', color: '#1f5fbf', accent: '#f2c230' },
  { name: 'branco', color: '#ecebe6', accent: '#b01a2c' },
  { name: 'grafite', color: '#3d4a52', accent: '#9fd3ff' },
  { name: 'preto', color: '#15181c', accent: '#e5a019' },
  { name: 'amarelo', color: '#f2b705', accent: '#1c1c1c' },
  { name: 'verde', color: '#1f7a4a', accent: '#e8e4da' },
  { name: 'roxo', color: '#6b2fd6', accent: '#d8d8e0' },
];

const DRIVE: Record<string, string> = { rear: 'traseira', front: 'dianteira' };

/** Technical sheet rows, all read or derived from the configuration used by the physics. */
export function specRows(car: CarConfig): [string, string][] {
  const e = car.engine;
  const litres = engineGeometry(e).displacement * 1000;
  let peak = 0;
  let peakRpm = 0;
  e.torqueCurve.torqueNm.forEach((t, i) => {
    if (t > peak) {
      peak = t;
      peakRpm = e.torqueCurve.rpm[i] ?? 0;
    }
  });
  return [
    ['Motor', `${e.architecture} ${litres.toFixed(1)} L · ${e.induction === 'turbo' ? 'turbo' : 'aspirado'}`],
    ['Potência anunciada', `${e.ratedPowerCv.toFixed(0)} cv`],
    ['Torque máximo', `${peak.toFixed(0)} N·m a ${peakRpm.toFixed(0)} rpm`],
    ['Faixa vermelha', `${e.redlineRpm.toFixed(0)} rpm`],
    ['Câmbio', `${car.transmission.gearRatios.length} marchas, semiautomático`],
    ['Tração', DRIVE[car.drivenAxle] ?? car.drivenAxle],
    ['Massa', `${car.massKg.toFixed(0)} kg`],
    ['Peso / potência', `${(car.massKg / e.ratedPowerCv).toFixed(2)} kg/cv`],
    ['Comprimento × altura', `${car.visual.lengthM.toFixed(2)} × ${car.visual.heightM.toFixed(2)} m`],
    ['Entre-eixos', `${car.wheelbaseM.toFixed(2)} m`],
    ['Pneus (raio)', `${(car.tires.radiusM * 1000).toFixed(0)} mm`],
  ];
}

export function openGarage(opts: GarageOptions): void {
  const purchase = opts.purchase;
  const opener = document.activeElement;
  let pending = false;
  let car: CarConfig = opts.current ? (opts.cars.find((c) => c.id === opts.current!.id) ?? opts.cars[0]!) : opts.cars[0]!;
  // start from the paint the mode's car already has
  let paint: { color: string; accent: string } | null = opts.current && opts.current.id === car.id && opts.current.visual.color !== car.visual.color ? { color: opts.current.visual.color, accent: opts.current.visual.accent } : null;
  const preview = new GarageVehiclePreview('studio');
  const title = h('h2', { 'data-testid': 'garage-name' }, '');
  const desc = h('div', { class: 'hint' }, '');
  const specs = h('div', { class: 'kv garage-specs', 'data-testid': 'garage-specs' });
  const swatches = h('div', { class: 'swatches' });
  const thumbs = h('div', { class: 'garage-thumbs' });
  const stageEl = h('div', { class: 'garage-stage' }, preview.canvas);
  const lamps = h('input', {
    type: 'checkbox',
    'data-testid': 'garage-lamps',
    onchange: (e: Event) => {
      preview.lights = (e.target as HTMLInputElement).checked;
      preview.render();
    },
  });
  const painted = (): CarConfig => (paint ? { ...car, visual: { ...car.visual, ...paint } } : car);
  const error = h('p', { class: 'hint warn', role: 'alert', 'data-testid': 'garage-purchase-error', hidden: true });

  const close = (): void => {
    if (pending) return;
    ro.disconnect();
    window.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    if (purchase && opener instanceof HTMLElement && opener.isConnected) opener.focus();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (purchase && e.key === 'Tab') {
      const controls = [...backdrop.querySelectorAll<HTMLElement>('button:enabled, input:enabled')];
      const first = controls[0];
      const last = controls.at(-1);
      const active = document.activeElement;
      if (!backdrop.contains(active) || active === (e.shiftKey ? first : last)) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
    }
  };

  const renderSwatches = (): void => {
    clear(swatches);
    const own = { name: 'original', color: car.visual.color, accent: car.visual.accent };
    for (const p of [own, ...PAINTS.filter((x) => x.color.toLowerCase() !== car.visual.color.toLowerCase())]) {
      const active = paint ? paint.color === p.color : p === own;
      swatches.append(
        h('button', {
          class: `swatch${active ? ' active' : ''}`,
          title: p.name,
          'aria-label': `cor ${p.name}`,
          'aria-pressed': String(active),
          'data-testid': 'garage-swatch',
          style: `background:${p.color}`,
          onclick: () => {
            paint = p === own ? null : { color: p.color, accent: p.accent };
            renderSwatches();
            void preview.setCar(painted());
          },
        }),
      );
    }
  };

  const show = (): void => {
    title.textContent = car.name;
    desc.textContent = car.description;
    clear(specs);
    for (const [k, v] of specRows(car)) specs.append(h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
    renderSwatches();
    for (const b of thumbs.querySelectorAll<HTMLElement>('button')) b.classList.toggle('active', b.dataset.car === car.id);
    void preview.setCar(painted());
  };

  for (const c of purchase ? [] : opts.cars) {
    const mini = new GarageVehiclePreview('plain');
    mini.fill = 0.9;
    mini.resize(132, 58);
    void mini.setCar(c);
    thumbs.append(
      h(
        'button',
        {
          class: 'thumb',
          'data-car': c.id,
          'data-testid': `garage-car-${c.id}`,
          onclick: () => {
            car = c;
            paint = null;
            show();
          },
        },
        mini.canvas,
        h('span', {}, c.name),
      ),
    );
  }

  const closeButton = h('button', { 'data-testid': 'garage-close', onclick: close }, 'Fechar');
  const useButton = h('button', {
    class: 'primary',
    'data-testid': 'garage-use',
    onclick: () => {
      if (purchase) void confirmPurchase();
      else {
        opts.onUse?.(car.id, paint);
        close();
      }
    },
  }, opts.useLabel);
  const setPending = (value: boolean): void => {
    pending = value;
    useButton.disabled = value;
    closeButton.disabled = value;
    for (const button of swatches.querySelectorAll('button')) button.disabled = value;
  };
  async function confirmPurchase(): Promise<void> {
    if (!purchase || pending) return;
    setPending(true);
    error.hidden = true;
    let message: string | null;
    try {
      message = await purchase.confirm(car.id, paint);
    } catch {
      message = 'Não foi possível concluir a compra. Tente novamente.';
    } finally {
      setPending(false);
    }
    if (message !== null) {
      error.textContent = message;
      error.hidden = false;
      useButton.focus();
      return;
    }
    close();
    purchase.onPurchased();
  }

  const backdrop: HTMLDivElement = h(
    'div',
    { class: 'modal-backdrop', onclick: (e: Event) => e.target === backdrop && close() },
    h(
      'div',
      { class: 'modal garage', role: 'dialog', 'aria-modal': purchase ? 'true' : undefined, 'aria-label': purchase ? 'Comprar carro' : 'Garagem', 'data-testid': purchase ? 'garage-purchase' : 'garage' },
      h('div', { class: 'garage-main' }, stageEl, purchase ? null : thumbs),
      h(
        'div',
        { class: 'garage-side' },
        title,
        desc,
        h('h3', {}, 'Ficha técnica'),
        specs,
        h('h3', {}, 'Pintura'),
        swatches,
        h('label', { class: 'row check' }, lamps, h('span', {}, 'faróis e lanternas acesos')),
        purchase ? error : null,
        h('div', { class: 'row garage-actions' }, useButton, closeButton),
      ),
    ),
  );
  document.body.append(backdrop);
  window.addEventListener('keydown', onKey, true);
  const ro = new ResizeObserver(() => {
    const r = stageEl.getBoundingClientRect();
    if (r.width > 10 && r.height > 10) {
      preview.resize(Math.floor(r.width), Math.floor(r.height));
      void preview.setCar(painted());
    }
  });
  ro.observe(stageEl);
  show();
  if (purchase) closeButton.focus();
}
