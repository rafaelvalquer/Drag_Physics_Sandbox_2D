import { h } from '../dom';

type PartStatusStyle = 'stock' | 'installed' | 'owned' | 'available' | 'unaffordable' | 'locked';

export function workshopPartHeading(name: HTMLElement, state: PartStatusStyle, label: string, testId?: string): HTMLElement {
  return h('div', { class: 'ws-part-head' }, name,
    h('span', { class: `pill ${state}`, 'data-testid': testId }, label));
}
