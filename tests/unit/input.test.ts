/**
 * Keyboard input under the semi-automatic plan: exactly three driving actions (throttle, upshift,
 * downshift) – no clutch and no brake – remappable without conflicts, progressive pedal, key
 * repeat ignored, everything released when the window loses focus.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ACTION_LABELS, DEFAULT_BINDINGS, DRIVE_ACTIONS, InputManager, META_ACTIONS, validateBindings } from '../../src/game/input/InputManager';

class FakeKeyboardEvent extends Event {
  constructor(
    type: string,
    readonly code: string,
    readonly repeat = false,
  ) {
    super(type, { cancelable: true });
  }
}

let win: EventTarget;
let input: InputManager;
const press = (code: string, repeat = false): void => void win.dispatchEvent(new FakeKeyboardEvent('keydown', code, repeat));
const release = (code: string): void => void win.dispatchEvent(new FakeKeyboardEvent('keyup', code));

beforeEach(() => {
  win = new EventTarget();
  (globalThis as unknown as { document: EventTarget & { hidden: boolean } }).document = Object.assign(new EventTarget(), { hidden: false });
  input = new InputManager(DEFAULT_BINDINGS, win as unknown as Window);
});
afterEach(() => input.dispose());

describe('input', () => {
  it('has exactly three driving actions: throttle, upshift, downshift (no clutch, no brake)', () => {
    expect([...DRIVE_ACTIONS]).toEqual(['throttle', 'upshift', 'downshift']);
    const all = [...DRIVE_ACTIONS, ...META_ACTIONS].join(' ');
    expect(all).not.toMatch(/clutch|brake|embreag|freio/i);
    expect(Object.values(ACTION_LABELS).join(' ')).not.toMatch(/embreagem|freio/i);
    expect(DEFAULT_BINDINGS.throttle).toEqual(['KeyW', 'ArrowUp']);
    expect(DEFAULT_BINDINGS.upshift).toEqual(['KeyE']);
    expect(DEFAULT_BINDINGS.downshift).toEqual(['KeyQ']);
    expect(validateBindings(DEFAULT_BINDINGS)).toEqual([]);
  });

  it('shift keys fire once per press; key repeat is ignored', () => {
    let up = 0;
    let down = 0;
    input.on('upshift', () => up++);
    input.on('downshift', () => down++);
    press('KeyE');
    press('KeyE', true);
    press('KeyE', true);
    release('KeyE');
    press('KeyE');
    release('KeyE');
    press('KeyQ');
    release('KeyQ');
    expect(up).toBe(2);
    expect(down).toBe(1);
  });

  it('the pedal is progressive: rises in ~0.09 s, falls in ~0.07 s, from either throttle key', () => {
    press('ArrowUp');
    const rise: number[] = [];
    for (let i = 0; i < 12; i++) rise.push(input.updatePedal(1 / 120));
    expect(rise[0]).toBeGreaterThan(0);
    expect(rise[0]).toBeLessThan(0.2);
    expect(rise[11]).toBe(1);
    expect(rise.every((v, i) => i === 0 || v >= rise[i - 1]!)).toBe(true);
    release('ArrowUp');
    for (let i = 0; i < 9; i++) input.updatePedal(1 / 120);
    expect(input.pedal).toBe(0);
  });

  it('losing focus releases the throttle', () => {
    press('KeyW');
    input.updatePedal(1);
    expect(input.pedal).toBe(1);
    win.dispatchEvent(new Event('blur'));
    expect(input.isDown('throttle')).toBe(false);
    input.updatePedal(1);
    expect(input.pedal).toBe(0);
  });

  it('remapping rejects conflicts and reserved keys, and applies valid maps', () => {
    const conflict = { ...DEFAULT_BINDINGS, downshift: ['KeyE'] };
    expect(validateBindings(conflict).length).toBeGreaterThan(0);
    expect(input.setBindings(conflict).length).toBeGreaterThan(0);
    expect(validateBindings({ ...DEFAULT_BINDINGS, upshift: ['Tab'] }).length).toBeGreaterThan(0);
    expect(validateBindings({ ...DEFAULT_BINDINGS, throttle: [] }).length).toBeGreaterThan(0);
    // a valid remap takes effect and the old key no longer shifts
    let up = 0;
    input.on('upshift', () => up++);
    expect(input.setBindings({ ...DEFAULT_BINDINGS, upshift: ['KeyD'] })).toEqual([]);
    press('KeyE');
    release('KeyE');
    press('KeyD');
    release('KeyD');
    expect(up).toBe(1);
  });

  it('capture mode hands the next key to the remapping UI instead of an action', () => {
    let got = '';
    let up = 0;
    input.on('upshift', () => up++);
    input.captureNextKey((c) => (got = c));
    press('KeyE');
    expect(got).toBe('KeyE');
    expect(up).toBe(0);
  });
});
