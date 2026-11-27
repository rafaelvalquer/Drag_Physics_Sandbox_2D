import type { CarConfig } from '../../data/schema';
import { assembleVehicleSprites, type VehicleSpriteSet } from '../../game/vehicles/VehicleSpriteAssembler';
import { drawPartAsset } from '../../game/vehicles/art/parts/PartIllustrations';
import { engineSpecOf } from '../../game/vehicles/art/parts/EngineDrawings';
import { composeScene, fitScene, hotspotPercent, type SceneGeometry } from '../../game/vehicles/art/parts/PartVisualComposer';
import type { VisualZone } from '../../game/vehicles/art/parts/PartVisualAnchors';
import type { AssetId, ViewMode } from '../../game/vehicles/art/parts/PartVisualRegistry';
import { h } from '../dom';
import { L } from './WorkshopCopy';
import type { VersionId } from './WorkshopVisualState';

const ZONE_NAME: Record<VisualZone, string> = {
  engine: 'Motor', intake: 'Admissão', turbo: 'Turbina', intercooler: 'Intercooler', exhaust: 'Saída do escape', transmission: 'Câmbio', clutch: 'Embreagem',
  diff: 'Diferencial', nitro: 'Cilindro de N₂O', cooling: 'Radiador', wheel: 'Roda', tire: 'Pneu', ecu: 'Central', suspension: 'Suspensão', weight: 'Carroceria',
};

/** What the stage shows: both versions of the car (the other one is null when unavailable) and how. */
export interface StageInput {
  beforeCar: CarConfig | null;
  afterCar: CarConfig | null;
  mode: ViewMode;
  version: VersionId;
  cut: number;
  zone: VisualZone | null;
  /** Illustrations of the detail view: the part in the slot now and the selected one. */
  detail: { before: AssetId | null; after: AssetId | null } | null;
  /** Message under the stage (view note, no-external-change warning...). */
  note: string;
  /** The "Com a peça" version only exists as a preview of a part that is not installed. */
  afterLabel: string;
  previewKind: 'none' | 'part' | 'pending' | 'unavailable' | 'equipped';
}

export interface StageView {
  root: HTMLElement;
  /** Canvas pair (for the animation controller and the tests). */
  frames: { before: HTMLElement; after: HTMLElement; wrap: HTMLElement };
  show(input: StageInput): void;
  /** Re-fits the canvases to the stage size (called on resize). */
  refit(): void;
  /** Geometry of the last paint (tests). */
  info(): { loaded: boolean; width: number; height: number; failed: boolean; paints: number };
  dispose(): void;
}

interface Slot {
  canvas: HTMLCanvasElement;
  set: VehicleSpriteSet | null;
  key: string;
  geo: SceneGeometry | null;
}

export function buildStage(on: { mode: (m: ViewMode) => void; version: (v: VersionId) => void; cut: (n: number) => void }): StageView {
  const mk = (id: string): HTMLCanvasElement => h('canvas', { class: `wv-canvas wv-canvas-${id}`, 'data-testid': `ws-canvas-${id}`, 'aria-hidden': 'true' }) as HTMLCanvasElement;
  const before: Slot = { canvas: mk('before'), set: null, key: '', geo: null };
  const after: Slot = { canvas: mk('after'), set: null, key: '', geo: null };
  const hot = h('div', { class: 'wv-hotspot-layer' });
  const cutline = h('div', { class: 'wv-cutline', 'aria-hidden': 'true' });
  const wrap = h('div', { class: 'wv-carwrap single', 'data-testid': 'ws-carwrap' },
    h('div', { class: 'wv-reflect' }),
    h('div', { class: 'wv-frame wv-frame-before' }, before.canvas),
    h('div', { class: 'wv-frame wv-frame-after' }, after.canvas),
    cutline, hot);
  const loading = h('div', { class: 'wv-loading', 'data-testid': 'ws-loading', role: 'status' }, 'Carregando o carro…');
  const failed = h('div', { class: 'wv-failed', 'data-testid': 'ws-failed', role: 'alert' }, 'Não foi possível desenhar o carro. ', h('button', { type: 'button', class: 'wv-btn', onclick: () => void paint(true) }, 'Tentar de novo'));
  loading.hidden = true;
  failed.hidden = true;

  const seg = <T extends string>(label: string, items: [T, string][], pick: (v: T) => void, testPrefix: string): { el: HTMLElement; set: (v: T) => void; hide: (v: T, hidden: boolean) => void; text: (v: T, t: string) => void } => {
    const btns = new Map<T, HTMLButtonElement>();
    const el = h('div', { class: 'wv-seg', role: 'group', 'aria-label': label });
    for (const [id, text] of items) {
      const b = h('button', { type: 'button', 'data-testid': `${testPrefix}-${id}`, 'aria-pressed': 'false', onclick: () => pick(id) }, text) as HTMLButtonElement;
      btns.set(id, b);
      el.append(b);
    }
    return {
      el,
      set: (v) => btns.forEach((b, id) => b.setAttribute('aria-pressed', String(id === v))),
      hide: (v, hidden) => { btns.get(v)!.hidden = hidden; },
      text: (v, t) => { btns.get(v)!.textContent = t; },
    };
  };
  const modes = seg<ViewMode>('Modo de visualização', [['external', L.modeExternal], ['technical', L.modeTechnical], ['detail', L.modeDetail]], on.mode, 'ws-mode');
  const versions = seg<VersionId>('Atual ou com a peça', [['now', L.versionNow], ['with', L.versionWith], ['slide', L.versionSlide]], on.version, 'ws-version');
  const slider = h('input', { type: 'range', min: '5', max: '95', value: '50', class: 'wv-slider', 'aria-label': 'Deslizar entre atual e com a peça', 'data-testid': 'ws-slider' }) as HTMLInputElement;
  slider.hidden = true;
  slider.addEventListener('input', () => on.cut(Number(slider.value)));
  const legend = h('div', { class: 'wv-legend', 'data-testid': 'ws-legend', 'aria-live': 'polite' });
  const noteEl = h('div', { class: 'wv-note', 'data-testid': 'ws-viewnote' });
  const stage = h('div', { class: 'wv-stage' }, loading, failed, wrap);
  const root = h('section', { class: 'wv-mid', 'data-testid': 'ws-stage', 'aria-label': 'Carro' },
    h('div', { class: 'wv-wall', 'aria-hidden': 'true' }), h('div', { class: 'wv-lamp l1', 'aria-hidden': 'true' }), h('div', { class: 'wv-lamp l2', 'aria-hidden': 'true' }), h('div', { class: 'wv-floor', 'aria-hidden': 'true' }),
    h('div', { class: 'wv-modes' }, modes.el, versions.el),
    stage,
    h('div', { class: 'wv-compare-bar' }, slider, legend),
    noteEl);

  let input: StageInput | null = null;
  let token = 0;
  let paints = 0;
  let failedState = false;
  let raf = 0;
  let disposed = false;
  let ro: ResizeObserver | null = null;
  let lastW = 0;
  let lastH = 0;

  const sizeOf = (): { w: number; h: number } => {
    const r = wrap.getBoundingClientRect();
    return { w: Math.max(200, Math.round(r.width)), h: Math.max(100, Math.round(r.height)) };
  };

  const pxPerMFor = (car: CarConfig, w: number): number => Math.min(280, Math.max(60, Math.ceil((w * 0.92) / car.visual.lengthM / 20) * 20));
  const artKey = (car: CarConfig): string => JSON.stringify([car.visual, car.wheelbaseM, car.tires.radiusM, car.exhaust.layout]);

  /** Loads the sprite set of a slot (cache hit in the assembler for a car that did not change its art). */
  async function load(slot: Slot, car: CarConfig | null, w: number): Promise<boolean> {
    if (!car) {
      slot.set = null;
      slot.key = '';
      return true;
    }
    const ppm = pxPerMFor(car, w);
    const key = `${ppm}|${artKey(car)}`;
    if (slot.key === key && slot.set) return true;
    slot.set = await assembleVehicleSprites(car, ppm);
    slot.key = key;
    return true;
  }

  function drawSlot(slot: Slot, car: CarConfig | null, i: StageInput, dpr: number, w: number, hgt: number, which: 'before' | 'after'): void {
    const cv = slot.canvas;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hgt * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(hgt * dpr);
    }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    if (i.mode === 'detail') {
      const asset = which === 'before' ? i.detail?.before : i.detail?.after;
      if (asset) {
        const spec = car ? engineSpecOf(car) : undefined;
        drawPartAsset(ctx, asset, w / 2, hgt * 0.5, Math.min(w * 0.6, hgt * 0.9), { engine: spec });
        ctx.fillStyle = 'rgba(233,237,242,0.7)';
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(which === 'before' ? 'Como está agora' : i.afterLabel, w / 2, hgt - 10);
      }
      slot.geo = null;
      return;
    }
    if (!slot.set || !car) return;
    const geo = fitScene(slot.set, w, hgt);
    slot.geo = geo;
    composeScene(ctx, slot.set, geo, i.mode === 'technical' ? { technical: { car, highlight: i.zone } } : { lights: false });
  }

  function placeHotspot(i: StageInput): void {
    hot.replaceChildren();
    const slot = i.version === 'now' ? before : after.set ? after : before;
    const car = slot === before ? i.beforeCar : i.afterCar;
    if (i.mode === 'detail' || !i.zone || !slot.set || !slot.geo || !car) return;
    const w = slot.canvas.clientWidth || 1;
    const hgt = slot.canvas.clientHeight || 1;
    const p = hotspotPercent(slot.geo, car, slot.set, i.zone, w, hgt);
    const el = h('div', { class: 'wv-hotspot', 'data-testid': 'ws-hotspot', style: `left:${p.left}%;top:${p.top}%` }, h('b', {}, ZONE_NAME[i.zone]));
    hot.append(el);
  }

  async function paint(force = false): Promise<void> {
    const i = input;
    if (!i || disposed) return;
    const my = ++token;
    const { w, h: hgt } = sizeOf();
    lastW = w;
    lastH = hgt;
    const needBefore = i.version !== 'with';
    const needAfter = i.version !== 'now' && !!i.afterCar;
    if (force) { before.key = ''; after.key = ''; }
    if (i.mode !== 'detail') {
      loading.hidden = !!(before.set || after.set) && !force;
      try {
        await Promise.all([needBefore ? load(before, i.beforeCar, w) : Promise.resolve(true), needAfter ? load(after, i.afterCar, w) : Promise.resolve(true)]);
      } catch {
        if (my === token) {
          failedState = true;
          loading.hidden = true;
          failed.hidden = false;
        }
        return;
      }
      if (my !== token || disposed) return;
    }
    failedState = false;
    failed.hidden = true;
    loading.hidden = true;
    const dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    if (needBefore) drawSlot(before, i.beforeCar, i, dpr, w, hgt, 'before');
    if (needAfter || (i.mode === 'detail' && i.version !== 'now')) drawSlot(after, i.afterCar ?? i.beforeCar, i, dpr, w, hgt, 'after');
    paints++;
    root.dataset.painted = String(paints);
    placeHotspot(i);
  }

  const schedule = (): void => {
    if (raf || disposed) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      void paint();
    });
  };

  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      const { w, h: hgt } = sizeOf();
      if (Math.abs(w - lastW) > 2 || Math.abs(hgt - lastH) > 2) schedule();
    });
    ro.observe(wrap);
  }

  const applyChrome = (i: StageInput): void => {
    modes.set(i.mode);
    versions.set(i.version);
    const has = i.previewKind !== 'none';
    versions.hide('with', !has);
    versions.hide('slide', !has || !i.afterCar);
    versions.text('with', i.previewKind === 'equipped' ? 'Sem a peça' : i.previewKind === 'pending' ? 'Com a peça e o que falta' : L.versionWith);
    wrap.className = `wv-carwrap ${i.version === 'slide' ? '' : 'single'}`;
    wrap.dataset.version = i.version;
    wrap.dataset.mode = i.mode;
    wrap.style.setProperty('--cut', `${i.cut}%`);
    slider.hidden = i.version !== 'slide';
    slider.value = String(i.cut);
    const frameBefore = wrap.querySelector<HTMLElement>('.wv-frame-before')!;
    const frameAfter = wrap.querySelector<HTMLElement>('.wv-frame-after')!;
    frameBefore.style.display = i.version === 'with' ? 'none' : '';
    frameAfter.style.display = i.version === 'now' ? 'none' : '';
    legend.textContent = !has || i.version === 'now' ? L.nowNote : i.version === 'slide' ? `◂ ${L.versionNow}  ·  ${i.afterLabel} ▸` : i.previewKind === 'pending' ? L.withPendingNote : i.previewKind === 'equipped' ? 'Mostrando: o carro sem esta peça (prévia).' : L.withNote;
    noteEl.textContent = i.note;
  };

  return {
    root,
    frames: { before: wrap.querySelector<HTMLElement>('.wv-frame-before')!, after: wrap.querySelector<HTMLElement>('.wv-frame-after')!, wrap },
    show(i) {
      const prev = input;
      input = i;
      applyChrome(i);
      // a slider move only changes the clip (CSS): no repaint
      if (prev && prev.cut !== i.cut && prev.beforeCar === i.beforeCar && prev.afterCar === i.afterCar && prev.mode === i.mode && prev.version === i.version && prev.zone === i.zone) return;
      schedule();
    },
    refit: schedule,
    info: () => ({ loaded: !!(before.set || after.set), width: lastW, height: lastH, failed: failedState, paints }),
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      before.set = null;
      after.set = null;
      before.canvas.width = 0;
      after.canvas.width = 0;
      void artKey;
    },
  };
}
