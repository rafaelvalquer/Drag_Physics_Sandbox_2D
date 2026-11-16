/**
 * Gear indicator: N for neutral, 1..n for the engaged gear, and the gear being selected (dimmed,
 * with an arrow) while the semi-automatic gearbox is changing. It only shows the state of the
 * simulated gearbox.
 */
export interface GearState {
  /** Engaged gear, 0 = neutral. */
  gear: number;
  shifting: boolean;
  /** Gear being selected during a change. */
  targetGear: number;
}

export function gearLabel(s: GearState): { text: string; arrow: '' | '▲' | '▼' } {
  const shown = s.shifting ? s.targetGear : s.gear;
  const text = shown <= 0 ? 'N' : String(shown);
  if (!s.shifting || s.targetGear === s.gear) return { text, arrow: '' };
  return { text, arrow: s.targetGear > s.gear ? '▲' : '▼' };
}

export class GearIndicator {
  readonly el: HTMLElement;
  private readonly num: HTMLElement;
  private readonly arrow: HTMLElement;
  private last = '';

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'gear-ind';
    this.el.setAttribute('data-testid', 'hud-gear');
    this.num = document.createElement('span');
    this.num.className = 'num';
    this.arrow = document.createElement('span');
    this.arrow.className = 'arrow';
    this.el.append(this.num, this.arrow);
  }

  update(s: GearState): void {
    const { text, arrow } = gearLabel(s);
    const key = `${text}|${arrow}|${s.shifting}`;
    if (key === this.last) return;
    this.last = key;
    this.num.textContent = text;
    this.arrow.textContent = arrow;
    this.el.classList.toggle('shifting', s.shifting);
  }
}
