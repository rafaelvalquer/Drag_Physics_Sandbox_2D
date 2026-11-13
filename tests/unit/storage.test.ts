/** IndexedDB persistence: versioned migrations, store API, volatile fallback and settings loading. */
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSetting } from '../../src/app/settings';
import { CARS } from '../../src/data/cars/index';
import { DB_VERSION, MemoryStore, openDatabase, openStore } from '../../src/storage/db';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

describe('IndexedDB store', () => {
  it('creates every store at the current version and round-trips values', async () => {
    const store = await openStore(new IDBFactory());
    expect(store.persistent).toBe(true);
    const car = structuredClone(CARS[0]!);
    await store.put('presets', { id: 'p1', name: 'mine', savedAt: '2026-01-01', car });
    await store.put('records', { key: 'arco|quarter|test', et: 16.2 });
    await store.put('settings', 0.4, 'masterVolume');
    await store.put('runs', { date: '2026-01-02', et: 15 });
    await store.put('runs', { date: '2026-01-03', et: 14 });
    expect((await store.get<{ car: typeof car }>('presets', 'p1'))?.car).toEqual(car);
    expect(await store.get('settings', 'masterVolume')).toBe(0.4);
    const runs = await store.getAll<{ id: number; et: number }>('runs');
    expect(runs.map((r) => r.id)).toEqual([1, 2]); // auto-increment keys
    await store.delete('presets', 'p1');
    expect(await store.get('presets', 'p1')).toBeUndefined();
    store.close();
  });

  it('migrates a version 1 database to version 2 without losing data', async () => {
    const factory = new IDBFactory();
    const v1 = await openDatabase(factory, 'migr', 1);
    expect([...v1.objectStoreNames]).toEqual(['presets', 'records', 'settings']);
    const tx = v1.transaction(['settings', 'presets'], 'readwrite');
    tx.objectStore('settings').put('35', 'masterVolume'); // v1 stored a percentage string
    tx.objectStore('presets').put({ id: 'keep', name: 'old preset' });
    await new Promise((r) => (tx.oncomplete = r));
    v1.close();

    const v2 = await openDatabase(factory, 'migr', 2);
    expect(DB_VERSION).toBe(2);
    expect([...v2.objectStoreNames]).toContain('runs');
    expect(v2.transaction('runs').objectStore('runs').indexNames.contains('byDate')).toBe(true);
    const vol = await req(v2.transaction('settings').objectStore('settings').get('masterVolume'));
    expect(vol).toBeCloseTo(0.35, 12);
    const kept = await req(v2.transaction('presets').objectStore('presets').get('keep'));
    expect(kept).toEqual({ id: 'keep', name: 'old preset' });
    v2.close();
  });

  it('falls back to a volatile in-memory store when IndexedDB cannot be opened', async () => {
    const broken = {
      open() {
        throw new Error('SecurityError: access denied');
      },
    } as unknown as IDBFactory;
    const origWarn = console.warn;
    console.warn = () => {};
    const store = await openStore(broken);
    console.warn = origWarn;
    expect(store).toBeInstanceOf(MemoryStore);
    expect(store.persistent).toBe(false);
    await store.put('runs', { date: 'x' });
    await store.put('runs', { date: 'y' });
    expect((await store.getAll<{ id: number }>('runs')).map((r) => r.id)).toEqual([1, 2]);
    // values are copied, not shared
    const obj = { key: 'k', et: 1 };
    await store.put('records', obj);
    obj.et = 2;
    expect((await store.get<{ et: number }>('records', 'k'))?.et).toBe(1);
  });
});

describe('settings', () => {
  it('loads defaults, keeps valid stored values and ignores invalid ones field by field', async () => {
    const store = new MemoryStore();
    expect(await loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    await saveSetting(store, 'masterVolume', 0.8);
    await saveSetting(store, 'units', 'mph');
    await store.put('settings', 'loud', 'audioQuality'); // invalid
    await store.put('settings', Number.NaN, 'muted'); // invalid type
    const s = await loadSettings(store);
    expect(s.masterVolume).toBe(0.8);
    expect(s.units).toBe('mph');
    expect(s.audioQuality).toBe(DEFAULT_SETTINGS.audioQuality);
    expect(s.muted).toBe(DEFAULT_SETTINGS.muted);
  });

  it('rejects stored key bindings with conflicts and keeps a valid remap', async () => {
    const store = new MemoryStore();
    await store.put('settings', { ...DEFAULT_SETTINGS.bindings, upshift: ['KeyW'] }, 'bindings'); // W is throttle
    expect((await loadSettings(store)).bindings).toEqual(DEFAULT_SETTINGS.bindings);
    await store.put('settings', { ...DEFAULT_SETTINGS.bindings, upshift: ['KeyX'], downshift: ['KeyZ'] }, 'bindings');
    const b = (await loadSettings(store)).bindings;
    expect(b.upshift).toEqual(['KeyX']);
    expect(b.downshift).toEqual(['KeyZ']);
  });
});
