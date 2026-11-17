import { tuneKey, TUNE_FIELDS, type BuildTune, type TuneField } from '../../../game/career/tuning/buildCommon';

/**
 * Dyno Lab editing state: the SAVED settings (what the car races with) and the DRAFT being edited.
 * Editing never rebuilds the screen and never writes the save; every change schedules a measurement
 * of the draft after a short debounce. Measurements are cached (bounded, least recently used) and a
 * measurement that finishes after a newer one was requested is discarded (never shown).
 */
export interface DynoTuningOptions<R> {
  saved: BuildTune;
  /** Measures a settings set; must give up (return null) once `isStale()` is true. */
  compute(tune: BuildTune, isStale: () => boolean): Promise<R | null>;
  /** A fresh, current measurement. `which` tells whether it is the saved or the draft settings. */
  onResult(r: R, tune: BuildTune, which: 'saved' | 'draft'): void;
  onBusy?(busy: boolean): void;
  debounceMs?: number;
  cacheSize?: number;
  /** Timer functions (tests inject fake ones). */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
}

export class DynoTuningController<R> {
  saved: BuildTune;
  draft: BuildTune;
  private readonly cache = new Map<string, R>();
  private gen = 0;
  private timer: unknown = null;
  private disposed = false;
  /** Measurements started / discarded as stale (diagnostics, tests). */
  readonly stats = { computed: 0, cacheHits: 0, discarded: 0 };

  constructor(private readonly o: DynoTuningOptions<R>) {
    this.saved = { ...o.saved };
    this.draft = { ...o.saved };
  }

  get dirty(): boolean {
    return tuneKey(this.saved) !== tuneKey(this.draft);
  }

  /** Changes one draft field (undefined = back to the hardware default) and schedules a measurement. */
  set<K extends TuneField>(field: K, value: BuildTune[K] | undefined): void {
    const next: BuildTune = { ...this.draft };
    if (value === undefined) delete next[field];
    else next[field] = value;
    this.draft = canonical(next);
    this.schedule();
  }

  /** Back to the saved settings. */
  discard(): void {
    this.draft = { ...this.saved };
    this.schedule();
  }

  /** The draft was written to the save: it is the new reference. */
  commit(applied: BuildTune = this.draft): void {
    this.saved = canonical({ ...applied });
    this.draft = { ...this.saved };
  }

  /** Measures the saved settings now (first measurement of the screen). */
  measureSaved(): Promise<void> {
    return this.run(this.saved, 'saved');
  }

  dispose(): void {
    this.disposed = true;
    this.gen++;
    if (this.timer !== null) (this.o.clearTimer ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>);
    this.timer = null;
  }

  private schedule(): void {
    if (this.disposed) return;
    this.gen++; // whatever is running now is stale
    if (this.timer !== null) (this.o.clearTimer ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>);
    const tune = { ...this.draft };
    this.o.onBusy?.(true); // pending: the shown figures are not the draft's yet
    this.timer = (this.o.setTimer ?? setTimeout)(() => {
      this.timer = null;
      void this.run(tune, 'draft');
    }, this.o.debounceMs ?? 350);
  }

  private async run(tune: BuildTune, which: 'saved' | 'draft'): Promise<void> {
    if (this.disposed) return;
    const key = tuneKey(tune);
    const hit = this.cache.get(key);
    if (hit !== undefined) {
      this.stats.cacheHits++;
      this.cache.delete(key);
      this.cache.set(key, hit); // most recently used
      this.o.onBusy?.(false);
      this.o.onResult(hit, tune, which);
      return;
    }
    const my = ++this.gen;
    const stale = (): boolean => this.disposed || my !== this.gen;
    this.o.onBusy?.(true);
    this.stats.computed++;
    let r: R | null = null;
    try {
      r = await this.o.compute(tune, stale);
    } finally {
      if (!stale()) this.o.onBusy?.(false);
    }
    if (r === null || stale()) {
      this.stats.discarded++;
      return;
    }
    this.cache.set(key, r);
    const max = this.o.cacheSize ?? 12;
    while (this.cache.size > max) this.cache.delete(this.cache.keys().next().value as string);
    this.o.onResult(r, tune, which);
  }

  /** Cached entries (tests). */
  get cacheSize(): number {
    return this.cache.size;
  }
}

/** Same settings with the fields in their canonical order. */
function canonical(t: BuildTune): BuildTune {
  const o: BuildTune = {};
  for (const f of TUNE_FIELDS) if (t[f] !== undefined) (o as Record<string, unknown>)[f] = t[f];
  return o;
}
