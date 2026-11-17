import { gsap } from 'gsap';

/**
 * GSAP animations of the campaign menu: entrance timeline, count-up of the numbers, ambient light,
 * pointer parallax, click feedback and the light transition between screens. Everything is scoped
 * to one root through `gsap.context()`, reverted on dispose, and never blocks a click: the DOM is
 * complete and interactive from the first frame (animations only change opacity/transform).
 */
export function prefersReducedMotion(low = false): boolean {
  try {
    return low || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return low;
  }
}

function finePointer(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

const FORMAT: Record<string, (v: number) => string> = {
  cr: (v) => `${Math.round(v).toLocaleString('pt-BR')} CR`,
  rep: (v) => `Reputação ${Math.round(v)}`,
  cv: (v) => `${Math.round(v)} cv`,
  nm: (v) => `${Math.round(v)} N·m`,
};

export class CareerMenuAnimations {
  private ctx: gsap.Context | null = null;
  private offs: (() => void)[] = [];
  private disposed = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly reduced: boolean,
  ) {}

  /** Starts the entrance and the ambient effects. Safe to call once; failures leave the static page. */
  play(): void {
    if (this.disposed || this.ctx) return;
    const root = this.root;
    try {
      this.ctx = gsap.context(() => {
        const q = (s: string): Element[] => gsap.utils.toArray(s, root);
        this.bindPress();
        if (this.reduced) return;
        const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
        tl.from(q('[data-anim=bg]'), { opacity: 0, duration: 0.5 }, 0)
          .from(q('[data-anim=title]'), { opacity: 0, y: -14, duration: 0.45 }, 0.1)
          .from(q('[data-anim=car]'), { opacity: 0, x: -36, duration: 0.7, ease: 'power3.out' }, 0.2)
          .fromTo(q('.cm-sheen'), { xPercent: -140, opacity: 0.9 }, { xPercent: 140, opacity: 0, duration: 0.9, ease: 'power1.inOut' }, 0.55)
          .from(q('[data-anim=spec]'), { opacity: 0, y: 10, duration: 0.35 }, 0.6)
          .from(q('[data-anim=next]'), { opacity: 0, x: 24, duration: 0.45 }, 0.45)
          .from(q('[data-anim=primary]'), { opacity: 0, scale: 0.96, duration: 0.3 }, 0.8)
          .from(q('[data-anim=tertiary]'), { opacity: 0, duration: 0.3 }, 1.1);
        const cards = q('[data-anim=secondary] > *'); // absent without a save
        if (cards.length) tl.from(cards, { opacity: 0, y: 10, duration: 0.3, stagger: 0.07 }, 0.9);
        // progress bar: from empty to the real value
        for (const bar of q('.cm-bar > i')) {
          const pct = (bar as HTMLElement).dataset.percent ?? '0';
          if (Number(pct) > 0) tl.fromTo(bar, { width: '0%' }, { width: `${pct}%`, duration: 0.7, ease: 'power2.inOut' }, 0.7);
        }
        // numbers count up and always end on the saved value
        for (const el of q('[data-count]')) {
          const e = el as HTMLElement;
          const target = Number(e.dataset.count);
          const fmt = FORMAT[e.dataset.fmt ?? ''];
          if (!fmt || !Number.isFinite(target) || target <= 0) continue;
          const o = { v: 0 };
          tl.to(o, { v: target, duration: 0.7, ease: 'power1.out', onUpdate: () => void (e.textContent = fmt(o.v)), onComplete: () => void (e.textContent = fmt(target)) }, 0.5);
        }
        // ambient: barely perceptible breathing of the workshop lights
        gsap.to(q('.cm-spot'), { opacity: '+=0.1', duration: 5, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 1.4 });
        this.parallax();
      }, root);
    } catch {
      this.dispose(); // reverts inline styles: the menu stays usable without animation
    }
  }

  /** Small response of the buttons when pressed (does not delay the click). */
  private bindPress(): void {
    const sel = 'button.cm-primary, button.cm-card-btn';
    const find = (e: Event): HTMLElement | null => (e.target as HTMLElement | null)?.closest?.(sel) ?? null;
    const down = (e: Event): void => {
      const b = find(e);
      if (b && !this.reduced) gsap.to(b, { scale: 0.975, duration: 0.08, overwrite: 'auto' });
    };
    const up = (e: Event): void => {
      const b = find(e);
      if (b) gsap.to(b, { scale: 1, duration: 0.18, ease: 'power2.out', overwrite: 'auto', clearProps: 'transform' });
    };
    this.root.addEventListener('pointerdown', down);
    this.root.addEventListener('pointerup', up);
    this.root.addEventListener('pointerout', up);
    this.offs.push(() => {
      this.root.removeEventListener('pointerdown', down);
      this.root.removeEventListener('pointerup', up);
      this.root.removeEventListener('pointerout', up);
    });
  }

  /** A few pixels of depth between the decorative layers; never on text or buttons. */
  private parallax(): void {
    if (!finePointer()) return;
    const layers = gsap.utils.toArray<HTMLElement>('[data-layer]', this.root).map((el) => ({ el, k: Number(el.dataset.layer) * 5, x: gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3.out' }), y: gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3.out' }) }));
    const move = (e: PointerEvent): void => {
      const nx = e.clientX / innerWidth - 0.5;
      const ny = e.clientY / innerHeight - 0.5;
      for (const l of layers) {
        l.x(nx * l.k);
        l.y(ny * l.k);
      }
    };
    window.addEventListener('pointermove', move, { passive: true });
    this.offs.push(() => window.removeEventListener('pointermove', move));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.offs) off();
    this.offs = [];
    this.ctx?.revert();
    this.ctx = null;
  }
}
