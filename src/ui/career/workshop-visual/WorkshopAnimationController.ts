import { gsap } from 'gsap';

/**
 * GSAP animations of the visual workshop (reusable timelines, one `gsap.context` per visit).
 * Created by the CareerTransitionManager when the workshop opens and disposed with it, so leaving
 * the screen reverts every tween. With reduced motion every method only does the end state, which
 * the DOM already has: nothing is animated and nothing waits.
 *
 * Durations: entrance 0.5-0.8 s, selection 0.18-0.35 s, install confirmation 0.4-0.7 s.
 */
export class WorkshopAnimationController {
  private ctx: gsap.Context | null = null;
  private disposed = false;

  constructor(private readonly root: HTMLElement, private readonly reduced: boolean) {
    try {
      this.ctx = gsap.context(() => undefined, root);
    } catch {
      this.ctx = null;
    }
  }

  get isReduced(): boolean {
    return this.reduced;
  }

  private run(fn: () => void): void {
    if (this.reduced || this.disposed || !this.ctx) return;
    try {
      this.ctx.add(fn);
    } catch {
      /* animation is cosmetic: never break the screen */
    }
  }

  /** Entrance of the screen: catalog and details slide in, the car rises under the lamps (about 0.7 s). */
  enter(): void {
    this.run(() => {
      const q = (s: string): HTMLElement[] => gsap.utils.toArray<HTMLElement>(s, this.root);
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo(q('.wv-mid'), { opacity: 0 }, { opacity: 1, duration: 0.5, clearProps: 'opacity' }, 0)
        .fromTo(q('.wv-carwrap'), { opacity: 0, y: 24, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, clearProps: 'opacity,transform' }, 0.1)
        .fromTo(q('.wv-catalog'), { opacity: 0, x: -28 }, { opacity: 1, x: 0, duration: 0.55, clearProps: 'opacity,transform' }, 0.05)
        .fromTo(q('.wv-inspector'), { opacity: 0, x: 28 }, { opacity: 1, x: 0, duration: 0.55, clearProps: 'opacity,transform' }, 0.12)
        .fromTo(q('.wv-modes'), { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.4, clearProps: 'opacity,transform' }, 0.3);
      const lamps = q('.wv-lamp');
      if (lamps.length) tl.fromTo(lamps, { opacity: 0 }, { opacity: 1, duration: 0.8, clearProps: 'opacity' }, 0.1);
    });
  }

  /** A part was selected: the details cross-fade and the card gets a short pulse (the list is not rebuilt). */
  select(inspector: HTMLElement, card: HTMLElement | null): void {
    this.run(() => {
      gsap.fromTo(inspector, { opacity: 0.2, y: 8 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out', clearProps: 'opacity,transform', overwrite: 'auto' });
      if (card) gsap.fromTo(card, { scale: 0.985 }, { scale: 1, duration: 0.22, ease: 'back.out(2)', clearProps: 'transform', overwrite: 'auto' });
    });
  }

  /** Category change: the list fades in, the car stays exactly where it is. */
  category(list: HTMLElement): void {
    this.run(() => {
      gsap.fromTo(list, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.24, ease: 'power2.out', clearProps: 'opacity,transform', overwrite: 'auto' });
    });
  }

  /** Before/after switch: the car cross-fades (the numbers keep their own values, nothing counts up). */
  compare(wrap: HTMLElement, deltas: HTMLElement[]): void {
    this.run(() => {
      gsap.fromTo(wrap, { opacity: 0.55 }, { opacity: 1, duration: 0.3, ease: 'power1.out', clearProps: 'opacity', overwrite: 'auto' });
      if (deltas.length) gsap.fromTo(deltas, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3, stagger: 0.03, ease: 'back.out(2)', clearProps: 'opacity,transform' });
    });
  }

  /** Install confirmed by the CareerController: a warm sweep over the car (about 0.6 s). Never called for a failed purchase. */
  installed(wrap: HTMLElement): void {
    this.run(() => {
      const tl = gsap.timeline();
      tl.to(wrap, { filter: 'drop-shadow(0 0 26px rgba(255,207,138,0.9)) brightness(1.18)', duration: 0.22, ease: 'power2.out' })
        .to(wrap, { filter: 'drop-shadow(0 0 0px rgba(255,207,138,0)) brightness(1)', duration: 0.42, ease: 'power2.inOut', clearProps: 'filter' });
      tl.fromTo(wrap, { scale: 1 }, { scale: 1.015, duration: 0.2, yoyo: true, repeat: 1, ease: 'sine.inOut', clearProps: 'transform' }, 0);
    });
  }

  /** The action is not available (locked, no credits): a short horizontal shake of the button. */
  denied(el: HTMLElement): void {
    this.run(() => {
      gsap.fromTo(el, { x: 0 }, { x: 0, keyframes: { x: [-6, 6, -4, 4, 0] }, duration: 0.3, ease: 'power1.inOut', clearProps: 'transform', overwrite: 'auto' });
    });
  }

  dispose(): void {
    this.disposed = true;
    this.ctx?.revert();
    this.ctx = null;
  }
}
