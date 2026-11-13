/**
 * Keyboard input. Driving actions are exactly the three of the semi-automatic transmission plan:
 * throttle (W / ↑), upshift (E), downshift (Q). There is no clutch and no brake key: the clutch is
 * automatic and braking after the finish is automatic. The remaining actions are meta controls
 * (restart, pause, mute, camera, panels) and never touch the vehicle physics.
 *
 * Bindings use `KeyboardEvent.code` (physical key, independent of the keyboard layout) and are
 * remappable. Key auto-repeat is ignored; losing focus releases everything.
 */
export type DriveAction = 'throttle' | 'upshift' | 'downshift';
export type MetaAction = 'restart' | 'pause' | 'mute' | 'camera' | 'telemetry';
export type ActionId = DriveAction | MetaAction;

export const DRIVE_ACTIONS: readonly DriveAction[] = ['throttle', 'upshift', 'downshift'];
export const META_ACTIONS: readonly MetaAction[] = ['restart', 'pause', 'mute', 'camera', 'telemetry'];

export type Bindings = Record<ActionId, string[]>;

export const DEFAULT_BINDINGS: Bindings = {
  throttle: ['KeyW', 'ArrowUp'],
  upshift: ['KeyE'],
  downshift: ['KeyQ'],
  restart: ['KeyR'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  camera: ['KeyC'],
  telemetry: ['KeyT'],
};

export const ACTION_LABELS: Record<ActionId, string> = {
  throttle: 'Acelerador',
  upshift: 'Subir marcha',
  downshift: 'Descer marcha',
  restart: 'Reiniciar simulação',
  pause: 'Pausar',
  mute: 'Silenciar áudio',
  camera: 'Câmera',
  telemetry: 'Painel de telemetria',
};

/** Human readable key name for a `KeyboardEvent.code`. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Space: 'Espaço',
    Escape: 'Esc',
    ShiftLeft: 'Shift E',
    ShiftRight: 'Shift D',
    ControlLeft: 'Ctrl E',
    ControlRight: 'Ctrl D',
    Enter: 'Enter',
  };
  return map[code] ?? code;
}

/** Codes that may never be bound (browser / OS shortcuts). */
const RESERVED = new Set(['Tab', 'MetaLeft', 'MetaRight', 'F5', 'F11', 'F12']);

export function validateBindings(b: Bindings): string[] {
  const errors: string[] = [];
  const owner = new Map<string, ActionId>();
  for (const a of [...DRIVE_ACTIONS, ...META_ACTIONS]) {
    const codes = b[a] ?? [];
    if (codes.length === 0 && DRIVE_ACTIONS.includes(a as DriveAction)) errors.push(`${ACTION_LABELS[a]}: nenhuma tecla atribuída`);
    for (const c of codes) {
      if (RESERVED.has(c)) errors.push(`${keyLabel(c)} é reservada pelo navegador`);
      const prev = owner.get(c);
      if (prev && prev !== a) errors.push(`${keyLabel(c)} está atribuída a "${ACTION_LABELS[prev]}" e "${ACTION_LABELS[a]}"`);
      owner.set(c, a);
    }
  }
  return errors;
}

export class InputManager {
  private bindings: Bindings;
  private codeToAction = new Map<string, ActionId>();
  private readonly down = new Set<ActionId>();
  private readonly listeners = new Map<ActionId, Set<() => void>>();
  /** Progressive pedal (keyboard is on/off; the pedal moves at a finite rate like a foot). */
  pedal = 0;
  pedalRiseS = 0.09;
  pedalFallS = 0.07;
  enabled = true;
  /** While capturing a key for remapping, all keys go to this callback. */
  private capture: ((code: string) => void) | null = null;
  private readonly target: Window;

  constructor(bindings: Bindings = DEFAULT_BINDINGS, target: Window = window) {
    this.bindings = structuredClone(bindings);
    this.target = target;
    this.rebuild();
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  getBindings(): Bindings {
    return structuredClone(this.bindings);
  }

  setBindings(b: Bindings): string[] {
    const errors = validateBindings(b);
    if (errors.length === 0) {
      this.bindings = structuredClone(b);
      this.rebuild();
    }
    return errors;
  }

  private rebuild(): void {
    this.codeToAction.clear();
    for (const [a, codes] of Object.entries(this.bindings) as [ActionId, string[]][]) for (const c of codes) this.codeToAction.set(c, a);
  }

  /** Next key press is delivered to `cb` instead of being an action (remapping UI). */
  captureNextKey(cb: (code: string) => void): void {
    this.capture = cb;
  }

  on(action: ActionId, cb: () => void): () => void {
    let set = this.listeners.get(action);
    if (!set) {
      set = new Set();
      this.listeners.set(action, set);
    }
    set.add(cb);
    return () => set.delete(cb);
  }

  isDown(action: ActionId): boolean {
    return this.down.has(action);
  }

  /** Advances the progressive pedal; returns the pedal position 0..1. */
  updatePedal(dt: number): number {
    const target = this.enabled && this.down.has('throttle') ? 1 : 0;
    if (target > this.pedal) this.pedal = Math.min(target, this.pedal + dt / this.pedalRiseS);
    else this.pedal = Math.max(target, this.pedal - dt / this.pedalFallS);
    return this.pedal;
  }

  private isTypingTarget(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
  }

  private readonly onDown = (e: KeyboardEvent): void => {
    if (this.capture) {
      e.preventDefault();
      const cb = this.capture;
      this.capture = null;
      cb(e.code);
      return;
    }
    if (this.isTypingTarget(e)) return;
    const a = this.codeToAction.get(e.code);
    if (!a) return;
    e.preventDefault();
    if (e.repeat) return;
    this.press(a);
  };

  /**
   * Presses an action (keyboard and on-screen buttons share this path). Held actions such as the
   * throttle stay down until release(); repeated presses while held are ignored.
   */
  press(a: ActionId): void {
    if (this.down.has(a)) return;
    this.down.add(a);
    if (!this.enabled && DRIVE_ACTIONS.includes(a as DriveAction)) return;
    const set = this.listeners.get(a);
    if (set) for (const cb of set) cb();
  }

  release(a: ActionId): void {
    this.down.delete(a);
  }

  private readonly onUp = (e: KeyboardEvent): void => {
    const a = this.codeToAction.get(e.code);
    if (a) this.down.delete(a);
  };

  private readonly releaseAll = (): void => {
    this.down.clear();
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) this.down.clear();
  };

  dispose(): void {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.releaseAll);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.listeners.clear();
  }
}
