import { gsap } from 'gsap';

/**
 * Screen transitions of the campaign. The new screen is rendered synchronously by
 * `CareerMode.show()` (its contract does not change); this manager only animates what was just
 * added: a short fade/rise of the screen and a stagger of the `[data-reveal]` blocks. A newer
 * transition cancels the older one, and `dispose()` reverts everything.
 */
export class CareerTransitionManager {
  private ctx: gsap.Context | null = null;
  private offs: (() => void)[] = [];

  /** Click feedback for buttons (does not delay the click). Installed once on the overlay root. */
  bindPress(root: HTMLElement, reduced: boolean): void {
    if (reduced) return;
    const sel = '.cs-btn, .cs-action, .cs-nav button, .cm-primary, .cm-card-btn';
    const find = (e: Event): HTMLElement | null => (e.target as HTMLElement | null)?.closest?.<HTMLElement>(sel) ?? null;
    const down = (e: Event): void => {
      const b = find(e);
      if (b && !(b as HTMLButtonElement).disabled) gsap.to(b, { scale: 0.975, duration: 0.08, overwrite: 'auto' });
    };
    const up = (e: Event): void => {
      const b = find(e);
      if (b) gsap.to(b, { scale: 1, duration: 0.16, ease: 'power2.out', overwrite: 'auto', clearProps: 'transform' });
    };
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointerout', up);
    this.offs.push(() => {
      root.removeEventListener('pointerdown', down);
      root.removeEventListener('pointerup', up);
      root.removeEventListener('pointerout', up);
    });
  }

  enter(el: HTMLElement, reduced: boolean): void {
    this.cancel();
    if (reduced) return;
    try {
      this.ctx = gsap.context(() => {
        gsap.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'opacity,transform' });
        const blocks = gsap.utils.toArray<HTMLElement>('[data-reveal]', el);
        if (blocks.length) gsap.from(blocks, { opacity: 0, y: 12, duration: 0.3, ease: 'power2.out', stagger: { each: 0.05, amount: 0.35 }, delay: 0.05, clearProps: 'opacity,transform' });
        // confrontation screens: sides slide in, the centre mark scales in
        for (const sl of gsap.utils.toArray<HTMLElement>('[data-slide]', el)) {
          const k = sl.dataset.slide;
          if (k === 'center') gsap.from(sl, { opacity: 0, scale: 0.6, duration: 0.35, delay: 0.25, ease: 'back.out(1.6)', clearProps: 'opacity,transform' });
          else gsap.from(sl, { opacity: 0, x: k === 'left' ? -40 : 40, duration: 0.45, delay: 0.05, ease: 'power3.out', clearProps: 'opacity,transform' });
        }
        // progress bars fill up to their real value
        for (const i of gsap.utils.toArray<HTMLElement>('.cs-bar > i', el)) {
          const pct = i.dataset.percent;
          if (pct && Number(pct) > 0) gsap.fromTo(i, { width: '0%' }, { width: `${pct}%`, duration: 0.6, delay: 0.15, ease: 'power2.inOut' });
        }
      }, el);
    } catch {
      this.cancel();
    }
  }

  cancel(): void {
    this.ctx?.revert();
    this.ctx = null;
  }

  dispose(): void {
    this.cancel();
    for (const off of this.offs) off();
    this.offs = [];
  }
}
