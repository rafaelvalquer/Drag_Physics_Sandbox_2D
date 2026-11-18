import type { SourceRef } from '../../provenance';

/**
 * Sources of the eight Chapter 3 cars (accessed 2026-11-17). Same hierarchy as chapter 2: the
 * manufacturers' press kits and specification pages are catalogue documents; Auto-Data, Kelley
 * Blue Book, Encycarpedia and the like are secondary technical sheets; "literature" entries are
 * general technical references that this project did NOT consult at a specific URL (values taken
 * from them are marked secondary or estimated where they are used); "estimate" entries are
 * documented engineering estimates. A source of another body, year or market says so in `note`.
 *
 * Units: the sheets publish hp (SAE), PS ("Hp" of Auto-Data), lb-ft, lb and in. The data files
 * convert them (hpToCv, lbftToNm, kg, mm): hp, cv and kW are never treated as the same unit.
 */
const A = '2026-11-17';

const lit = (id: string, title: string, modelYear: string, note: string): SourceRef => ({ id, title, url: '', modelYear, nature: 'literature', accessed: A, note });

export const CHAPTER3_SOURCES: Record<string, SourceRef> = {
  // ---- manufacturer documents (press kits, specification pages)
  'nissan-350z-2006-presskit': {
    id: 'nissan-350z-2006-presskit',
    title: 'Nissan — Press kit do 350Z Coupé e Roadster 2006',
    url: 'https://usa.nissannews.com/en-US/releases/2006-nissan-350z-coupe-and-roadster-press-kit',
    modelYear: 2006,
    nature: 'catalogue',
    accessed: A,
    note: 'VQ35DE 3,5 L, 300 hp (SAE J1349), 260 lb-ft, corte em 7.000 rpm, entre-eixos 104,3 in, Cd 0,30 (0,29 Track/Grand Touring), pneus. O texto consultado não traz diâmetro × curso, taxa, relações nem massa.',
  },
  'nissan-370z-2014-presskit': {
    id: 'nissan-370z-2014-presskit',
    title: 'Nissan — Press kit do 370Z Coupé 2014',
    url: 'https://usa.nissannews.com/en-US/releases/us-2014-nissan-370z-coupe-press-kit',
    modelYear: 2014,
    nature: 'catalogue',
    accessed: A,
    note: 'VQ37VHR: 95,5 × 86,0 mm, 11:1, 332 hp a 7.000 rpm, 270 lb-ft a 5.200 rpm, giro máximo 7.500 rpm; manual de 6 marchas (3,794/2,324/1,624/1,271/1,000/0,794, final 3,692); 3.278 lb; entre-eixos 100,4 in; 167,2 × 72,6 × 51,8 in; Cd 0,30.',
  },
  'lexus-is-2015-pressroom': {
    id: 'lexus-is-2015-pressroom',
    title: 'Lexus — Release de produto da linha IS 2015',
    url: 'https://pressroom.lexus.com/lexus-2015-is-models-product-news-release/',
    modelYear: 2015,
    nature: 'catalogue',
    accessed: A,
    note: 'V6 3,5 L de 306 hp e 277 lb-ft, câmbio automático de oito marchas (SPDS), tração traseira ou integral. Não traz código do motor, diâmetro × curso, taxa, relações, massa nem dimensões absolutas.',
  },
  'mbusa-c43-2017': {
    id: 'mbusa-c43-2017',
    title: 'Mercedes-Benz USA — Especificações do Mercedes-AMG C 43 Sedan 2017',
    url: 'https://media.mbusa.com/news/2017-mercedes-amg-c43-sedan-specifications',
    modelYear: 2017,
    nature: 'catalogue',
    accessed: A,
    note: 'V6 biturbo 88,0 × 82,1 mm, 2.996 cc, 10,5:1, 362 hp a 5.500–6.000 rpm, 384 lb-ft a 2.000–4.200 rpm, corte 6.550 rpm; 9G-TRONIC (5,35/3,24/2,25/1,64/1,21/1,00/0,86/0,72/0,60, final 3,07); 4MATIC 31:69; 3.759 lb; entre-eixos 111,8 in; 185 × 71,3 × 56,3 in; 225/45 R18 e 245/40 R18; 0–60 mph em 4,6 s. Não traz a pressão do turbo nem o Cd.',
  },
  'nissan-gtr-2015-presskit': {
    id: 'nissan-gtr-2015-presskit',
    title: 'Nissan — Press kit do GT-R 2015',
    url: 'https://usa.nissannews.com/en-US/releases/us-2015-nissan-gt-r-press-kit',
    modelYear: 2015,
    nature: 'catalogue',
    accessed: A,
    note: 'VR38DETT: 95,5 × 88,4 mm, 9,0:1, 545 hp a 6.400 rpm, 463 lb-ft a 3.200–5.800 rpm, giro máximo 7.000 rpm, dois turbos IHI; dupla embreagem de 6 marchas (4,056/2,301/1,595/1,248/1,001/0,796, final traseiro 3,700); ATTESA E-TS de 0:100 a 50:50; 3.851 lb; entre-eixos 109,4 in; 183,8 × 74,6 × 53,9 in; Cd 0,26; pneus 255/40 ZRF20 e 285/35 ZRF20. Não traz 0–60 nem a pressão do turbo.',
  },
  'alfa-giulia-qv-2017-specs': {
    id: 'alfa-giulia-qv-2017-specs',
    title: 'Fiat 500 USA — Especificações da Alfa Romeo Giulia Quadrifoglio 2017 (planilha da FCA)',
    url: 'https://www.fiat500usa.com/2015/11/2017-alfa-giulia-qv-specifications.html',
    modelYear: 2017,
    nature: 'technical-sheet',
    accessed: A,
    note: 'Planilha PRELIMINAR do carro europeu de pré-produção, com câmbio manual Getrag (o carro do jogo é o automático): 86,5 × 82,0 mm, 2.891 cc, 9,3:1, 505 hp a 6.500 rpm, 443 lb-ft a 2.500–5.500 rpm, corte 6.500 e giro máximo 7.250 rpm; 1.524 kg; entre-eixos 2.820 mm; 4.639 × 1.873 × 1.426 mm; Cd 0,32; 245/35 ZR19 e 285/30 ZR19; 0–60 mph em 3,8 s.',
  },
  // ---- secondary sheets
  'encycarpedia-350z-2006': {
    id: 'encycarpedia-350z-2006',
    title: 'Encycarpedia — Nissan 350Z Coupé 2006',
    url: 'https://www.encycarpedia.com/nissan/06-350z-coupe',
    modelYear: 2006,
    nature: 'technical-sheet',
    accessed: A,
    note: 'Valores lidos no resumo do resultado de busca (a página inteira não foi aberta): VQ35DE 95,5 × 81,4 mm e 10,3:1.',
  },
  'motormatchup-350z-2006': {
    id: 'motormatchup-350z-2006',
    title: 'Motor Matchup — Nissan 350Z 2006 Touring (manual de 6 marchas)',
    url: 'https://www.motormatchup.com/catalog/Nissan/350Z/2006/Touring-(6_speed-Manual)',
    modelYear: 2006,
    nature: 'technical-sheet',
    accessed: A,
    note: 'Resumo da busca: 1ª 3,794, 6ª 0,794 e final 3,538; massa de ≈ 3.346–3.370 lb nas versões Enthusiast e Track. As marchas intermediárias usadas são as do mesmo câmbio do 370Z (press kit) e estão marcadas como estimadas.',
  },
  'autodata-lexus-is350-2015': {
    id: 'autodata-lexus-is350-2015',
    title: 'Auto-Data — Lexus IS III (XE30) 350 V6 306 hp Direct Shift',
    url: 'https://www.auto-data.net/en/lexus-is-iii-xe30-350-v6-306hp-direct-shift-53751',
    modelYear: '2013–2016',
    nature: 'technical-sheet',
    accessed: A,
    note: '2GR-FSE: 94 × 83 mm, 11,8:1, 306 hp a 6.400 rpm, 376 N·m a 4.800 rpm; 1.630 kg; entre-eixos 2.800 mm; 4.665 × 1.810 × 1.430 mm; Cd 0,28; 0–60 mph em 5,6 s. A página é de uma versão europeia: o carro do jogo usa a potência e o torque do release da Lexus.',
  },
  'autodata-stinger-gt-2019': {
    id: 'autodata-stinger-gt-2019',
    title: 'Auto-Data — Kia Stinger GT 3.3 GDI 366 hp AWD Automatic',
    url: 'https://auto-data.net/en/kia-stinger-gt-3.3-gdi-366hp-awd-automatic-36044',
    modelYear: '2018–2023',
    nature: 'technical-sheet',
    accessed: A,
    note: 'G6DP: 92 × 83,8 mm, 10:1, 366 Hp (métricos) a 6.000 rpm, 510 N·m a 1.300–4.500 rpm; 1.858–1.905 kg; entre-eixos 2.905 mm; 4.830 × 1.870 × 1.400 mm; 225/40 R19 e 255/35 R19; 0–100 km/h em 5,5 s; 270 km/h. Versão europeia: o carro usa 365 hp e 376 lb-ft (ficha americana do plano).',
  },
  'kia-stinger-2019-brochure': {
    id: 'kia-stinger-2019-brochure',
    title: 'Kia — Brochura do Stinger 2019 (PDF do plano)',
    url: 'https://www.kia.com/content/dam/kia/us/brochures/brochure_stinger_2019.pdf',
    modelYear: 2019,
    nature: 'catalogue',
    accessed: A,
    note: 'Aberta, mas o PDF não tem texto extraível por esta ferramenta: NENHUM valor deste carro foi tirado dela.',
  },
  'kbb-ghibli-2015': {
    id: 'kbb-ghibli-2015',
    title: 'Kelley Blue Book — Maserati Ghibli 2015, especificações',
    url: 'https://www.kbb.com/maserati/ghibli/2015/specs/',
    modelYear: 2015,
    nature: 'technical-sheet',
    accessed: A,
    note: 'Resumo da busca: Ghibli S Q4 com 404 hp a 5.500 rpm e 406 lb-ft.',
  },
  'autodata-ghibli-s-q4': {
    id: 'autodata-ghibli-s-q4',
    title: 'Auto-Data — Maserati Ghibli III (M157) S Q4 3.0 V6 410 hp AWD Automatic',
    url: 'https://www.auto-data.net/en/maserati-ghibli-iii-m157-s-q4-3.0-v6-410hp-awd-automatic-22819',
    modelYear: '2013–2017',
    nature: 'technical-sheet',
    accessed: A,
    note: '86,5 × 84,5 mm, 9,7:1, 410 Hp (métricos) a 5.500 rpm, 550 N·m a 4.500–5.000 rpm, biturbo; 1.870 kg; entre-eixos 2.998 mm; 4.971 × 1.945 × 1.461 mm; 235/50 R18 e 275/45 R18; 0–100 km/h em 4,8 s; 284 km/h. Sem Cd.',
  },
  'autodata-giulia-qv-2017': {
    id: 'autodata-giulia-qv-2017',
    title: 'Auto-Data — Alfa Romeo Giulia (952) Quadrifoglio 2.9 V6 510 hp Automatic',
    url: 'https://www.auto-data.net/en/alfa-romeo-giulia-952-quadrifoglio-2.9-v6-510hp-automatic-32065',
    modelYear: '2016–',
    nature: 'technical-sheet',
    accessed: A,
    note: '86,5 × 82 mm, 9,3:1, 510 Hp (métricos) a 6.500 rpm, 600 N·m a 2.500 rpm; tração traseira; entre-eixos 2.820 mm; 4.639 × 1.426 mm; 0–100 km/h em 3,9 s; 307 km/h. A página não traz a massa nem o Cd; a massa de 1.580 kg vem de uma única listagem sem verificação (carexpert.co.nz).',
  },
  'wikipedia-alfa-690t': {
    id: 'wikipedia-alfa-690t',
    title: 'Wikipedia — Alfa Romeo 690T engine',
    url: 'https://en.wikipedia.org/wiki/Alfa_Romeo_690T_engine',
    modelYear: '2015–',
    nature: 'literature',
    accessed: A,
    note: 'Resumo da busca: V6 a 90° com três moentes a 120°, cada um com duas bielas lado a lado: disparo irregular 90°/150° (240° por bancada), harmônico principal de ordem 1,5. A ordem de ignição difere entre as fontes (1-6-3-4-2-5 e 1-6-3-4-5-2); usa-se 1-6-3-4-2-5.',
  },
  // ---- general literature (no specific URL consulted)
  'literature-nissan-vq': lit('literature-nissan-vq', 'Literatura técnica — Nissan VQ35DE/VQ37VHR', '2002–2020', 'V6 a 60°, ordem de ignição 1-2-3-4-5-6 (banco 1: 1-3-5; banco 2: 2-4-6), moentes divididos (disparo de 120°), biela de ≈ 152 mm.'),
  'literature-toyota-2gr': lit('literature-toyota-2gr', 'Literatura técnica — Toyota 2GR-FSE', '2005–', 'V6 a 60°, Dual VVT-i, injeção D-4S, ordem 1-2-3-4-5-6, biela de ≈ 144 mm.'),
  'literature-mercedes-m276': lit('literature-mercedes-m276', 'Literatura técnica — Mercedes-Benz M276 DE30 AL', '2011–', 'V6 a 60°, injeção direta, biturbo (um por bancada), ordem de ignição 1-4-3-6-2-5.'),
  'literature-kia-lambda2': lit('literature-kia-lambda2', 'Literatura técnica — Hyundai/Kia Lambda II 3.3 T-GDI', '2017–', 'V6 a 60°, injeção direta, biturbo (um por bancada).'),
  'literature-maserati-f160': lit('literature-maserati-f160', 'Literatura técnica — Maserati F160 (Ghibli, Quattroporte)', '2013–2019', 'V6 a 60° de 2.979 cc, injeção direta, biturbo (um por bancada); o projeto do virabrequim não foi encontrado.'),
  'literature-alfa-690t': lit('literature-alfa-690t', 'Literatura técnica — Alfa Romeo 690T (derivado Ferrari)', '2015–', 'V6 a 90° biturbo, bloco e cabeçotes de alumínio, injeção direta.'),
  'literature-nissan-vr38': lit('literature-nissan-vr38', 'Literatura técnica — Nissan VR38DETT', '2007–2024', 'V6 a 60°, ordem 1-2-3-4-5-6, dois turbos IHI, cilindros com revestimento por plasma.'),
  'literature-lexus-aisin-8': lit('literature-lexus-aisin-8', 'Literatura técnica — câmbio automático de 8 marchas Aisin (Lexus)', '2013–', 'Relações do IS 350 não encontradas: usa-se a faixa típica de um oito marchas de conversor (estimativa).'),
  'literature-hyundai-8at': lit('literature-hyundai-8at', 'Literatura técnica — câmbio automático de 8 marchas Hyundai/Kia (tração traseira/integral)', '2017–', 'Relações do Stinger não encontradas: usa-se a faixa típica de um oito marchas de conversor (estimativa).'),
  'literature-maserati-q4': lit('literature-maserati-q4', 'Literatura técnica — Maserati Q4 (tração integral sob demanda)', '2013–', 'Repartição normal quase toda traseira, com acoplamento que envia até a metade ao eixo dianteiro.'),
  'literature-attesa-ets': lit('literature-attesa-ets', 'Literatura técnica — Nissan ATTESA E-TS', '2007–', 'Tração traseira de base, com embreagem multidisco que transfere até 50 % ao eixo dianteiro (press kit: 0:100 a 50:50).'),
  'literature-4matic-c43': lit('literature-4matic-c43', 'Literatura técnica — Mercedes 4MATIC (AMG Performance)', '2014–', 'Repartição estática 31:69 (página do fabricante).'),
  // ---- documented estimates
  'estimate-chapter3-aero': {
    id: 'estimate-chapter3-aero',
    title: 'Estimativa do projeto — aerodinâmica e massas não publicadas (Capítulo 3)',
    url: '',
    modelYear: '—',
    nature: 'literature',
    accessed: A,
    note: 'Cx, área frontal, altura do CG, inércias e distribuição de peso estimados por carroceria semelhante quando a ficha consultada não publica; marcados como "estimated" no código.',
  },
  'estimate-chapter3-gearing': {
    id: 'estimate-chapter3-gearing',
    title: 'Estimativa do projeto — relações e finais não publicados (Capítulo 3)',
    url: '',
    modelYear: '—',
    nature: 'literature',
    accessed: A,
    note: 'Relação, final ou acoplamento de tração sem tabela consultada, deduzido do câmbio da mesma família e da velocidade por marcha; marcado como estimado.',
  },
};
