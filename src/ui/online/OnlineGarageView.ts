import { findPart } from '../../game/career/tuning/parts';
import { ONLINE_MARKET } from '../../game/online/catalog';
import type { GarageRequest } from '../../game/online/contracts';
import type { Garage } from '../../game/online/OnlineClient';
import { PREPARATION_TREES } from '../../game/online/preparation';
import { h } from '../dom';
import { specRows } from '../garage/GarageDialog';
import { GarageVehiclePreview } from '../garage/GarageVehiclePreview';

export type OnlineCar = Garage['cars'][number];
type Action = GarageRequest['operation'];
type Operate = (action: Action) => Promise<void>;
const money = (amount: number) => `${amount.toLocaleString('pt-BR')} CR`;
const button = (label: string, onclick: () => void, disabled = false) => h('button', { onclick, disabled }, label);

export function garageCards(garage: Garage, mutate: Operate, project: (car: OnlineCar, section: 'tree' | 'workshop' | 'dyno' | 'history') => void): HTMLElement {
  return h('div', { class: 'online-grid' }, garage.cars.map((car) => {
    const active = garage.profile.active_car_id === car.id;
    const preview = new GarageVehiclePreview('studio');
    preview.resize(260, 112);
    preview.canvas.setAttribute('aria-label', car.config.name);
    const config = car.paint ? { ...car.config, visual: { ...car.config.visual, color: car.paint } } : car.config;
    void preview.setCar(config).catch(() => { preview.canvas.hidden = true; });
    const tree = PREPARATION_TREES.get(car.base_car_id)!;
    const completion = Math.round(100 * (car.unlocks.length - 1) / Math.max(1, tree.nodes.length - 1));
    const paint = h('input', { type: 'color', value: car.paint ?? car.config.visual.color, 'aria-label': `Pintura de ${car.config.name}`,
      onchange: (event) => { void mutate({ kind: 'paint', carId: car.id, paint: (event.target as HTMLInputElement).value }); } });
    return h('article', { class: 'online-card' }, h('header', {}, h('h2', {}, car.config.name), active && h('span', {}, 'Em uso')), preview.canvas,
      h('p', {}, `${Math.round(car.peakPowerCv)} cv · ${Math.round(car.peakTorqueNm)} N·m · ${Math.round(car.config.massKg)} kg`),
      h('dl', { class: 'online-specs' }, specRows(car.config).flatMap(([key, value]) => [h('dt', {}, key), h('dd', {}, value)])),
      h('p', {}, `${car.pp_balance} PP · Árvore ${completion}% · ${car.total_races} corridas · ${car.wins} V / ${car.losses} D`),
      h('p', {}, car.parts.length ? car.parts.map((id) => findPart(id)?.name ?? id).join(', ') : 'Peças originais'),
      h('label', { class: 'row' }, 'Pintura', paint),
      h('div', { class: 'row' }, button('Selecionar', () => { void mutate({ kind: 'select', carId: car.id }); }, active),
        button('Preparação', () => project(car, 'tree')), button('Oficina', () => project(car, 'workshop')),
        button('Dinamômetro', () => project(car, 'dyno')), button('Histórico', () => project(car, 'history')),
        button('Vender', () => {
          if (window.confirm(`Vender ${car.config.name} por ${money(Math.round(car.purchase_price * 0.6))}? A progressão deste projeto será encerrada.`)) {
            void mutate({ kind: 'sell', carId: car.id, confirmed: true });
          }
        }, garage.cars.length < 2)));
  }));
}

export function market(credits: number, mutate: Operate): HTMLElement {
  const list = h('div', { class: 'online-grid' });
  const model = h('input', { type: 'search', placeholder: 'Buscar modelo' });
  const brandOf = (name: string) => name.startsWith('Alfa Romeo ') ? 'Alfa Romeo' : name.split(' ')[0]!;
  const dropdown = (values: readonly (readonly [string, string])[]) =>
    h('select', {}, h('option', { value: '' }, 'Todos'), values.map(([value, label]) => h('option', { value }, label)));
  const brands = [...new Set(ONLINE_MARKET.map((car) => brandOf(car.name)))].sort();
  const brand = dropdown(brands.map((value) => [value, value]));
  const induction = dropdown([['NA', 'Aspirado'], ['turbo', 'Turbo']]);
  const drive = dropdown([['front', 'Dianteira'], ['rear', 'Traseira'], ['awd', 'Integral']]);
  const transmission = dropdown([['manual', 'Manual'], ['dual-clutch', 'Dupla embreagem'], ['torque-converter-auto', 'Automático']]);
  const price = h('input', { type: 'number', min: 0, placeholder: 'Sem limite' });
  const repaint = (): void => {
    const results = ONLINE_MARKET.filter((car) => car.name.toLocaleLowerCase('pt-BR').includes(model.value.toLocaleLowerCase('pt-BR')) &&
      (!brand.value || brandOf(car.name) === brand.value) && (!induction.value || car.induction === induction.value) &&
      (!drive.value || car.drive === drive.value) && (!transmission.value || car.transmission === transmission.value) &&
      (!Number.isFinite(price.valueAsNumber) || car.price <= price.valueAsNumber));
    list.replaceChildren(...results.map((car) => h('article', { class: 'online-card' },
      h('h2', {}, car.name), h('p', {}, money(car.price)), button('Comprar', () => { void mutate({ kind: 'buy', baseCarId: car.id }); }, credits < car.price))));
    if (!results.length) list.append(h('p', {}, 'Nenhum modelo corresponde aos filtros.'));
  };
  [model, brand, induction, drive, transmission, price].forEach((input) => input.addEventListener('input', repaint));
  repaint();
  return h('section', {}, h('div', { class: 'online-filters' }, h('label', {}, 'Modelo', model), h('label', {}, 'Fabricante', brand),
    h('label', {}, 'Aspiração', induction), h('label', {}, 'Tração', drive), h('label', {}, 'Transmissão', transmission), h('label', {}, 'Preço máximo (CR)', price)), list);
}

export function preparationTree(car: OnlineCar, mutate: Operate, focusNode?: string): HTMLElement {
  const tree = PREPARATION_TREES.get(car.base_car_id)!;
  const unlocked = new Set(car.unlocks);
  const nodes = new Map(tree.nodes.map((node) => [node.id, node]));
  const original = nodes.get('original')!;
  const completed = tree.nodes.filter((node) => node.tier > 0 && unlocked.has(node.id)).length;
  const focus = (id: string): void => {
    const target = document.getElementById(id);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest' });
  };
  return h('section', {},
    h('h2', {}, car.config.name),
    h('p', {}, `${car.pp_balance} PP disponíveis · ${car.pp_earned_total} ganhos · ${car.pp_spent_total} utilizados`),
    h('p', {}, `${completed} de ${tree.nodes.length - 1} preparações desbloqueadas · Árvore v${tree.version}`),
    h('nav', { class: 'row online-tree-navigation', 'aria-label': 'Ramos da preparação' }, tree.branches.map((branch) =>
      button(branch.name, () => focus(`online-branch-${branch.id}`)))),
    h('article', { class: 'online-card', id: 'online-node-original', tabindex: -1, 'aria-label': original.name },
      h('strong', {}, original.name), h('p', {}, original.description)),
    h('div', { class: 'online-tree' }, tree.branches.map((branch) => h('section', { class: 'online-tree-branch' },
      h('h3', { id: `online-branch-${branch.id}`, tabindex: -1 }, branch.name),
      tree.nodes.filter((node) => node.branchId === branch.id).map((node) => {
        const have = unlocked.has(node.id);
        const required = node.prerequisites.filter((id) => !unlocked.has(id));
        const missingPP = Math.max(0, node.costPP - car.pp_balance);
        return h('article', { class: `online-card${focusNode === node.id ? ' online-focused' : ''}`,
          id: `online-node-${node.id}`, tabindex: -1, 'aria-label': node.name },
          h('strong', {}, node.name), h('p', {}, node.description), h('p', {}, node.unlocksPartIds.map((id) => findPart(id)?.name).join(', ')),
          required.length > 0 && h('ul', { class: 'online-tree-prerequisites', 'aria-label': 'Pré-requisitos pendentes' }, required.map((id) => {
            const name = nodes.get(id)!.name;
            return h('li', {}, h('button', { type: 'button', 'aria-label': `Ir para ${name}`, onclick: () => focus(`online-node-${id}`) }, name));
          })),
          !have && missingPP > 0 && h('p', {}, `Faltam ${missingPP} PP`),
          button(have ? 'Desbloqueado' : `Desbloquear por ${node.costPP} PP`, () => {
            if (window.confirm(`Usar ${node.costPP} PP para desbloquear ${node.name}?`)) void mutate({ kind: 'unlock', carId: car.id, nodeId: node.id });
          }, have || required.length > 0 || missingPP > 0));
      })))));
}
