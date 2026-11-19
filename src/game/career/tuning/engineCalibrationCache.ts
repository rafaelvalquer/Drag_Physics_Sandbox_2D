import type { EngineConfig } from '../../../data/schema';

/** Engine tables are expensive and can be shared by builds with different tyres or transmissions. */
export function memoizeEngineCalibration<Parts, Result>(
  calibrate: (stock: EngineConfig, parts: Parts) => Result,
): (stock: EngineConfig, parts: Parts) => Result {
  const cache = new Map<string, Result>();
  return (stock, parts) => {
    const key = JSON.stringify([stock, parts]);
    if (cache.has(key)) {
      const hit = cache.get(key)!;
      cache.delete(key);
      cache.set(key, hit);
      return structuredClone(hit);
    }
    const result = calibrate(stock, parts);
    cache.set(key, structuredClone(result));
    if (cache.size > 256) cache.delete(cache.keys().next().value!);
    return result;
  };
}
