/**
 * Generates docs/vehicles/campaign-cars.md from the data (sources, documented values, targets)
 * and from measurements of the game's own physics (dyno and acceleration test), so the sheet
 * cannot drift from the code.
 *
 *   npx tsx scripts/docs-campaign-cars.ts > docs/vehicles/campaign-cars.md
 */
import { CAMPAIGN_CARS } from '../src/data/cars/campaign';
import { CAMPAIGN_SOURCES } from '../src/data/cars/campaignSources';
import { CAMPAIGN_TARGETS } from '../src/data/cars/campaignTargets';
import { UNO_MILLE_1995_DOC } from '../src/data/cars/fiatUnoMille1995';
import { CELTA_2003_DOC } from '../src/data/cars/gmCelta2003';
import { CORSA_GL_1996_DOC } from '../src/data/cars/gmCorsaGl1996';
import { KADETT_SL_1992_DOC } from '../src/data/cars/gmKadettSl1992';
import { CHEVETTE_SL_1988_DOC } from '../src/data/cars/gmChevetteSl1988';
import { SAVEIRO_GL_1994_DOC } from '../src/data/cars/vwSaveiroGl1994';
import { FIASA_10_1995_DOC } from '../src/data/engines/fiatFiasa10_1995';
import { FAMILIA1_VHC_10_2003_DOC } from '../src/data/engines/gmFamilia1Vhc10_2003';
import { FAMILIA1_EFI_14_1996_DOC } from '../src/data/engines/gmFamilia1Efi14_1996';
import { FAMILIA2_18_1992_DOC } from '../src/data/engines/gmFamilia2_18_1992';
import { CHEVETTE_16S_1988_DOC } from '../src/data/engines/gmChevette16S_1988';
import { AP1800_GAS_1994_DOC } from '../src/data/engines/vwAp1800Gasoline1994';
import { TRACKS } from '../src/data/tracks/index';
import { runAccelerationTest } from '../src/game/race/accelerationTest';
import { EngineDyno } from '../src/physics/engine/EngineDyno';

const H = 1 / 120;
const track = TRACKS.find((t) => t.id === 'test-track')!;
const DOCS: Record<string, { car: { sources: readonly string[]; body: string; tyres: string; drive: string; transmission: { gearRatios: readonly number[]; finalDrive: number } }; engine: { code: string; displacementCm3: number; compressionRatio: number; fuel: string; feed: string; sources: readonly string[] } }> = {
  'fiat-uno-mille-1995': { car: UNO_MILLE_1995_DOC, engine: FIASA_10_1995_DOC },
  'gm-celta-2003': { car: CELTA_2003_DOC, engine: FAMILIA1_VHC_10_2003_DOC },
  'gm-corsa-gl-1996': { car: CORSA_GL_1996_DOC, engine: FAMILIA1_EFI_14_1996_DOC },
  'gm-kadett-sl-1992': { car: KADETT_SL_1992_DOC, engine: FAMILIA2_18_1992_DOC },
  'gm-chevette-sl-1988': { car: CHEVETTE_SL_1988_DOC, engine: CHEVETTE_16S_1988_DOC },
  'vw-saveiro-gl-1994': { car: SAVEIRO_GL_1994_DOC, engine: AP1800_GAS_1994_DOC },
};
const n = (v: number, d = 1): string => v.toFixed(d).replace('.', ',');

const out: string[] = [];
const p = (s = ''): void => void out.push(s);
p('# Carros da campanha — fichas de referência');
p();
p('Gerado por `npx tsx scripts/docs-campaign-cars.ts` a partir dos dados e de medições da própria física do jogo');
p('(dinamômetro do motor e teste de aceleração na Test Track). Não editar à mão.');
p();
p('Regras seguidas:');
p();
p('- Cada valor tem origem: **fábrica/ficha** (fonte listada), **derivado** (calculado de valores documentados),');
p('  **estimado** (não encontrado em fonte; valor plausível, marcado no código) ou **calibrado** (ajustado para a');
p('  física reproduzir um alvo documentado — nunca o torque: a curva passa pelos pontos documentados).');
p('- Divergências entre fontes ficam registradas, e a fonte escolhida é dita.');
p('- A arte dos carros é original e procedural (silhueta, proporções e detalhes de época), sem fotos nem logotipos.');
p('- O Gol GTS 1988 é o mesmo objeto do Sandbox; sua ficha completa está em [vw-gol-gts-1988.md](vw-gol-gts-1988.md).');
p();
p('| carro | potência alvo | medida | torque alvo | medido | 0–100 alvo | simulado | carga do teste |');
p('|---|---:|---:|---:|---:|---:|---:|---:|');
const rows: string[] = [];
const sheets: string[][] = [];
for (const car of CAMPAIGN_CARS) {
  const t = CAMPAIGN_TARGETS[car.id]!;
  const e = car.engine;
  const d = new EngineDyno(e);
  d.start();
  let pk = { cv: 0, rpm: 0 };
  let tk = { nm: 0, rpm: 0 };
  for (let r = 1600; r <= e.revLimitRpm; r += 200) {
    const m = d.measure(r, 1, H, 0.6, 0.15);
    if (m.powerCv > pk.cv) pk = { cv: m.powerCv, rpm: r };
    if (m.torqueNm > tk.nm) tk = { nm: m.torqueNm, rpm: r };
  }
  const a = runAccelerationTest({ ...car, massKg: car.massKg + t.testPayloadKg }, track, { speedsKmh: [100], distancesM: [402], maxS: 40 });
  const t100 = a.speedTimes.get(100) ?? null;
  rows.push(
    `| ${car.name} | ${n(t.powerCv)} cv @ ${t.powerRpm} | ${n(pk.cv)} cv @ ${pk.rpm} | ${n(t.torqueNm)} N·m @ ${t.torqueRpm} | ${n(tk.nm)} N·m @ ${tk.rpm} | ${n(t.accel0to100S)} s | ${t100 === null ? '—' : `${n(t100, 2)} s`} | ${t.testPayloadKg} kg |`,
  );
  const doc = DOCS[car.id];
  if (!doc) continue;
  const s: string[] = [];
  s.push(`## ${car.name}`);
  s.push('');
  s.push(car.description);
  s.push('');
  s.push(`- Carroceria: ${doc.car.body}; tração ${doc.car.drive}; pneus ${doc.car.tyres}.`);
  s.push(`- Motor: ${doc.engine.code}, ${doc.engine.displacementCm3} cm³, taxa ${n(doc.engine.compressionRatio)}:1, ${doc.engine.fuel}, ${doc.engine.feed}.`);
  s.push(`- Câmbio: ${doc.car.transmission.gearRatios.map((g) => n(g, 2)).join(' / ')}; diferencial ${n(doc.car.transmission.finalDrive, 2)}.`);
  s.push(`- Massa no jogo: ${car.massKg} kg (vazio + piloto 75 kg + combustível); Cx ${n(car.dragCoefficient, 2)}, área ${n(car.frontalAreaM2, 2)} m².`);
  s.push(`- Limite de giro: ${e.revLimitRpm} rpm; marcha lenta ${e.idleRpm} rpm.`);
  if (t.note) s.push(`- Tolerância: ${t.note}`);
  s.push('');
  s.push('Fontes (consultadas em 16/11/2026):');
  s.push('');
  for (const id of [...new Set([...doc.car.sources, ...doc.engine.sources])]) {
    const src = CAMPAIGN_SOURCES[id];
    if (!src) continue;
    s.push(`- [${src.title}](${src.url}) — ${src.nature}, ano ${src.modelYear}.${src.note ? ` ${src.note}` : ''}`);
  }
  s.push('');
  sheets.push(s);
}
for (const r of rows) p(r);
p();
p('Medido = varredura do dinamômetro do jogo (borboleta toda aberta, 1600 rpm até o corte, passo de 200 rpm). Simulado =');
p('teste de aceleração do jogo com piloto automático ideal e a carga indicada (0 kg para números de fábrica, 90 kg para');
p('testes de revista de época: segundo ocupante e instrumentação).');
p();
for (const s of sheets) for (const l of s) p(l);
p('## Divergências e escolhas');
p();
for (const src of Object.values(CAMPAIGN_SOURCES)) {
  if (src.note && /diverg|OUTRA VERSÃO|não verificado|não encontrad/i.test(src.note)) p(`- **${src.title}**: ${src.note}`);
}
p();
console.log(out.join('\n'));
