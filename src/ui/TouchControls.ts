import type { DriveAction, InputManager } from '../game/input/InputManager';
import { h } from './dom';

/**
 * On-screen driving buttons for touch screens and mouse: downshift, upshift and a hold-to-press
 * throttle. They go through the same InputManager path as the keyboard (no extra controls:
 * there is no clutch and no brake, as in the semi-automatic plan).
 */
export class TouchControls {
  readonly el: HTMLElement;

  constructor(parent: HTMLElement, input: InputManager) {
    const button = (action: DriveAction, label: string, title: string, cls = ''): HTMLButtonElement => {
      const b = h('button', { class: cls, title, 'aria-label': title, tabindex: -1, 'data-testid': `touch-${action}` }, label) as HTMLButtonElement;
      const up = (): void => {
        if (!b.classList.contains('held')) return;
        b.classList.remove('held');
        input.release(action);
      };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try {
          b.setPointerCapture(e.pointerId);
        } catch {
          // not an active pointer (synthetic event): the press still counts, release on pointerup
        }
        b.classList.add('held');
        input.press(action);
      });
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return b;
    };
    this.el = h(
      'div',
      { class: 'touch-controls', 'data-testid': 'touch-controls' },
      h('div', { class: 'shift-pair' }, button('downshift', '− marcha', 'Descer marcha'), button('upshift', '+ marcha', 'Subir marcha')),
      button('throttle', 'ACELERAR', 'Acelerador (mantenha pressionado)', 'throttle'),
    );
    parent.append(this.el);
  }

  setVisible(visible: boolean): void {
    this.el.classList.toggle('hidden', !visible);
    this.el.parentElement?.classList.toggle('touch-on', visible);
  }

  /** "auto" shows the buttons on touch screens (coarse pointer) only. */
  static wanted(setting: 'auto' | 'on' | 'off'): boolean {
    if (setting !== 'auto') return setting === 'on';
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  }
}
