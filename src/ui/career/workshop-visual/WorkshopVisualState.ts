import type { ViewMode } from '../../../game/vehicles/art/parts/PartVisualRegistry';
import type { FilterId } from './WorkshopCopy';

/**
 * UI state of the visual workshop (never saved, never part of the CareerSave): which system tab,
 * search, filter, selected part, view mode and before/after version are showing. The screen keeps
 * one instance for the whole visit, so a purchase or a category change never loses the selection.
 */
export type VersionId = 'now' | 'with' | 'slide';

export interface WorkshopViewState {
  tab: string | null;
  query: string;
  filter: FilterId;
  /** Part id, or `stock:<category>` for the factory part of a slot. */
  selected: string | null;
  mode: ViewMode;
  /** True once the player picked a mode by hand: a new selection then keeps it. */
  modePinned: boolean;
  version: VersionId;
  /** Position of the before/after slider (percent). */
  cut: number;
}

export const INITIAL_STATE: WorkshopViewState = { tab: null, query: '', filter: 'all', selected: null, mode: 'external', modePinned: false, version: 'now', cut: 50 };

export class WorkshopVisualState {
  private s: WorkshopViewState = { ...INITIAL_STATE };
  private readonly listeners = new Set<(s: WorkshopViewState, changed: ReadonlySet<keyof WorkshopViewState>) => void>();

  get value(): Readonly<WorkshopViewState> {
    return this.s;
  }

  /** Applies a patch and notifies with the keys that really changed (nothing if nothing did). */
  patch(p: Partial<WorkshopViewState>): void {
    const changed = new Set<keyof WorkshopViewState>();
    for (const k of Object.keys(p) as (keyof WorkshopViewState)[]) if (this.s[k] !== p[k]) changed.add(k);
    if (!changed.size) return;
    this.s = { ...this.s, ...p };
    for (const l of this.listeners) l(this.s, changed);
  }

  subscribe(l: (s: WorkshopViewState, changed: ReadonlySet<keyof WorkshopViewState>) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  dispose(): void {
    this.listeners.clear();
  }
}
