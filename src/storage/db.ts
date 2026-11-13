/**
 * IndexedDB persistence with explicit, versioned migrations.
 *
 * Stores:
 *  - settings: key → value (bindings, volume, units, quality…)
 *  - presets:  user car presets (CarConfig JSON, validated on load)
 *  - records:  best results per car / track / distance
 *  - runs:     recent race results (history)
 *
 * Every migration is idempotent and runs inside the `upgradeneeded` transaction. If IndexedDB is
 * not available (private mode, blocked storage) the app falls back to an in-memory store and
 * reports it (`persistent === false`) instead of failing.
 */
export const DB_NAME = 'drag-physics-sandbox-2d';
export const DB_VERSION = 2;

type Migration = (db: IDBDatabase, tx: IDBTransaction) => void;

export const MIGRATIONS: Record<number, Migration> = {
  1: (db) => {
    if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    if (!db.objectStoreNames.contains('presets')) db.createObjectStore('presets', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'key' });
  },
  2: (db, tx) => {
    if (!db.objectStoreNames.contains('runs')) {
      const runs = db.createObjectStore('runs', { keyPath: 'id', autoIncrement: true });
      runs.createIndex('byDate', 'date');
    }
    // v1 stored the master volume as a percentage string; v2 stores a number 0..1
    const settings = tx.objectStore('settings');
    const req = settings.get('masterVolume');
    req.onsuccess = () => {
      const v = req.result as unknown;
      if (typeof v === 'string') settings.put(Math.min(1, Math.max(0, Number.parseFloat(v) / 100 || 0.5)), 'masterVolume');
    };
  },
};

export interface Store {
  persistent: boolean;
  get<T>(store: string, key: IDBValidKey): Promise<T | undefined>;
  put<T>(store: string, value: T, key?: IDBValidKey): Promise<void>;
  delete(store: string, key: IDBValidKey): Promise<void>;
  getAll<T>(store: string): Promise<T[]>;
  clear(store: string): Promise<void>;
  close(): void;
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function openDatabase(factory: IDBFactory = indexedDB, name = DB_NAME, version = DB_VERSION): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, version);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const tx = req.transaction!;
      const from = ev.oldVersion;
      for (let v = from + 1; v <= version; v++) MIGRATIONS[v]?.(db, tx);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
  });
}

class IdbStore implements Store {
  persistent = true;
  constructor(private readonly db: IDBDatabase) {}
  private os(store: string, mode: IDBTransactionMode): IDBObjectStore {
    return this.db.transaction(store, mode).objectStore(store);
  }
  get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
    return promisify(this.os(store, 'readonly').get(key)) as Promise<T | undefined>;
  }
  async put<T>(store: string, value: T, key?: IDBValidKey): Promise<void> {
    await promisify(key === undefined ? this.os(store, 'readwrite').put(value) : this.os(store, 'readwrite').put(value, key));
  }
  async delete(store: string, key: IDBValidKey): Promise<void> {
    await promisify(this.os(store, 'readwrite').delete(key));
  }
  getAll<T>(store: string): Promise<T[]> {
    return promisify(this.os(store, 'readonly').getAll()) as Promise<T[]>;
  }
  async clear(store: string): Promise<void> {
    await promisify(this.os(store, 'readwrite').clear());
  }
  close(): void {
    this.db.close();
  }
}

/** Volatile fallback with the same interface. */
export class MemoryStore implements Store {
  persistent = false;
  private readonly data = new Map<string, Map<string, unknown>>();
  private readonly keyPaths: Record<string, string | null> = { settings: null, presets: 'id', records: 'key', runs: 'id' };
  private autoId = 1;
  private m(store: string): Map<string, unknown> {
    let s = this.data.get(store);
    if (!s) {
      s = new Map();
      this.data.set(store, s);
    }
    return s;
  }
  async get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
    return structuredClone(this.m(store).get(String(key))) as T | undefined;
  }
  async put<T>(store: string, value: T, key?: IDBValidKey): Promise<void> {
    const kp = this.keyPaths[store];
    let k = key;
    if (k === undefined && kp) {
      const obj = value as Record<string, unknown>;
      if (obj[kp] === undefined) obj[kp] = this.autoId++;
      k = obj[kp] as IDBValidKey;
    }
    this.m(store).set(String(k), structuredClone(value));
  }
  async delete(store: string, key: IDBValidKey): Promise<void> {
    this.m(store).delete(String(key));
  }
  async getAll<T>(store: string): Promise<T[]> {
    return [...this.m(store).values()].map((v) => structuredClone(v)) as T[];
  }
  async clear(store: string): Promise<void> {
    this.m(store).clear();
  }
  close(): void {}
}

export async function openStore(factory?: IDBFactory): Promise<Store> {
  try {
    const f = factory ?? (typeof indexedDB !== 'undefined' ? indexedDB : undefined);
    if (!f) return new MemoryStore();
    return new IdbStore(await openDatabase(f));
  } catch (e) {
    console.warn('IndexedDB unavailable, using volatile storage:', e);
    return new MemoryStore();
  }
}
