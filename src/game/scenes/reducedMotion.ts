/** The player asked the system for less motion: camera and body effects of the nitro stay off (light and flame stay). */
let cached: boolean | null = null;
export function prefersReducedMotion(): boolean {
  if (cached === null) cached = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return cached;
}
