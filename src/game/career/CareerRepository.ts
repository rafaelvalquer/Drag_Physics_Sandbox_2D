import type { Store } from '../../storage/db';
import { parseCareerSave, type CareerSave } from './CareerState';

/**
 * Persistence of the career save. Every change is ONE read-modify-write transaction on the slot
 * document (Store.update), guarded by an optimistic revision counter: if another tab wrote the
 * slot in the meantime the change is refused instead of silently overwriting it.
 */
export const CAREER_STORE = 'career';

export class CareerConflictError extends Error {
  constructor() {
    super('O save da campanha foi alterado em outra aba. Recarregue a campanha para continuar.');
    this.name = 'CareerConflictError';
  }
}

export class CareerRepository {
  constructor(
    readonly store: Store,
    readonly slotId: string,
  ) {}

  get persistent(): boolean {
    return this.store.persistent;
  }

  /** The stored save, null when there is none. Throws when the stored document is invalid. */
  async load(): Promise<CareerSave | null> {
    const doc = await this.store.get<unknown>(CAREER_STORE, this.slotId);
    if (doc === undefined) return null;
    const r = parseCareerSave(doc);
    if (!r.ok) throw new Error(`save da campanha inválido: ${r.errors.join('; ')}`);
    return r.save;
  }

  /**
   * Applies `fn` to the stored save atomically. `expectedRevision` is the revision the caller's
   * copy has (null = the slot must be empty, i.e. a new career). The result is validated before
   * it is written; on any error nothing is written.
   */
  async transact(expectedRevision: number | null, fn: (s: CareerSave | null) => CareerSave): Promise<CareerSave> {
    return this.store.update<CareerSave>(CAREER_STORE, this.slotId, (cur) => {
      const currentRev = cur === undefined ? null : cur.revision;
      if (currentRev !== expectedRevision) throw new CareerConflictError();
      // the stored document may still be in an older format (e.g. a v1 save written before chapter
      // 2): migrate and validate it exactly as load() does, so `fn` always gets the current shape
      let base: CareerSave | null = null;
      if (cur !== undefined) {
        const parsed = parseCareerSave(structuredClone(cur));
        if (!parsed.ok) throw new Error(`save da campanha inválido: ${parsed.errors.join('; ')}`);
        base = parsed.save;
      }
      const next = fn(base);
      next.slotId = this.slotId;
      next.revision = (currentRev ?? -1) + 1;
      next.updatedAt = new Date().toISOString();
      const v = parseCareerSave(next);
      if (!v.ok) throw new Error(`alteração inválida do save: ${v.errors.join('; ')}`);
      return v.save;
    });
  }

  /** Replaces the slot with an imported (already validated) save, whatever is stored. */
  async replace(save: CareerSave): Promise<CareerSave> {
    return this.store.update<CareerSave>(CAREER_STORE, this.slotId, (cur) => {
      const next = structuredClone(save);
      next.slotId = this.slotId;
      next.revision = (cur?.revision ?? -1) + 1;
      next.updatedAt = new Date().toISOString();
      const v = parseCareerSave(next);
      if (!v.ok) throw new Error(v.errors.join('; '));
      return v.save;
    });
  }

  async remove(): Promise<void> {
    await this.store.delete(CAREER_STORE, this.slotId);
  }
}

/**
 * One tab at a time per career slot: a Web Lock held while the campaign is open. Without the Web
 * Locks API the revision check of the repository still prevents lost updates.
 */
export class CareerTabLock {
  private release: (() => void) | null = null;
  held = false;

  async acquire(slotId: string): Promise<boolean> {
    const locks = (globalThis.navigator as Navigator | undefined)?.locks;
    if (!locks) {
      this.held = true;
      return true;
    }
    return new Promise<boolean>((resolve) => {
      locks
        .request(`drag-career-${slotId}`, { ifAvailable: true }, (lock) => {
          if (!lock) {
            resolve(false);
            return undefined;
          }
          this.held = true;
          resolve(true);
          return new Promise<void>((done) => {
            this.release = done;
          });
        })
        .catch(() => resolve(false));
    });
  }

  releaseLock(): void {
    this.release?.();
    this.release = null;
    this.held = false;
  }
}
