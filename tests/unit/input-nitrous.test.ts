/** The nitrous key: Shift by default, one press = one request, repeat and held keys do nothing more. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, InputManager, validateBindings } from '../../src/game/input/InputManager';

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
let presses = 0;
const key = (type: 'keydown' | 'keyup', code: string, repeat = false, target: unknown = null): void => {
  const ev = new FakeKeyboardEvent(type, code, repeat);
  if (target) Object.defineProperty(ev, 'target', { value: target }); // the element that had the focus
  win.dispatchEvent(ev);
};

beforeEach(() => {
  win = new EventTarget();
  (globalThis as unknown as { document: EventTarget & { hidden: boolean } }).document = Object.assign(new EventTarget(), { hidden: false });
  input = new InputManager(DEFAULT_BINDINGS, win as unknown as Window);
  presses = 0;
  input.on('nitrous', () => presses++);
});
afterEach(() => input.dispose());

describe('nitrous key', () => {
  it('is ShiftLeft by default and valid next to the other bindings', () => {
    expect(DEFAULT_BINDINGS.nitrous).toEqual(['ShiftLeft']);
    expect(validateBindings(DEFAULT_BINDINGS)).toEqual([]);
  });

  it('a press is one request; auto-repeat and holding the key add nothing; releasing does not cancel', () => {
    key('keydown', 'ShiftLeft');
    for (let i = 0; i < 10; i++) key('keydown', 'ShiftLeft', true);
    expect(presses).toBe(1);
    key('keyup', 'ShiftLeft'); // nothing to cancel: the discharge runs by itself
    expect(presses).toBe(1);
    key('keydown', 'ShiftLeft');
    expect(presses).toBe(2); // a new press is a new request (stage 2)
  });

  it('is ignored while typing and after the window loses focus', () => {
    key('keydown', 'ShiftLeft', false, { tagName: 'INPUT' });
    expect(presses).toBe(0);
    key('keydown', 'ShiftLeft');
    win.dispatchEvent(new Event('blur'));
    key('keydown', 'ShiftLeft'); // released by the blur: a press again
    expect(presses).toBe(2);
  });

  it('can be remapped to ShiftRight, but not onto a key another action uses', () => {
    const b = input.getBindings();
    b.nitrous = ['ShiftRight'];
    expect(input.setBindings(b)).toEqual([]);
    key('keydown', 'ShiftLeft');
    expect(presses).toBe(0);
    key('keydown', 'ShiftRight');
    expect(presses).toBe(1);
    const clash = input.getBindings();
    clash.nitrous = ['KeyE'];
    expect(input.setBindings(clash).join()).toMatch(/atribuída/);
  });

  it('settings saved before the key existed get the default Shift', () => {
    const old = { ...DEFAULT_BINDINGS } as Record<string, string[]>;
    delete old.nitrous;
    const m = new InputManager(old as unknown as typeof DEFAULT_BINDINGS, win as unknown as Window);
    expect(m.getBindings().nitrous).toEqual(['ShiftLeft']);
    m.dispose();
  });
});
