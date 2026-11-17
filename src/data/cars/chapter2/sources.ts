import type { SourceRef } from '../../provenance';

/**
 * Sources of the ten chapter 2 cars (accessed 2026-11-16). Hierarchy as in provenance.ts: the two
 * owner's manuals are factory documents; the importer/press sheets are secondary; "literature"
 * entries are general technical references (manufacturer press material, workshop literature,
 * engineering texts) that this project did NOT consult at a specific URL — values taken from them
 * are marked as secondary or estimated where they are used; "estimate" entries are documented
 * engineering estimates. A source that describes another version or year says so in `note`.
 */
const A = '2026-11-16';

const lit = (id: string, title: string, modelYear: string, note: string): SourceRef => ({ id, title, url: '', modelYear, nature: 'literature', accessed: A, note });

export const CHAPTER2_SOURCES: Record<string, SourceRef> = {
  // ---- factory documents
  'gm-astra-2011-manual': {
    id: 'gm-astra-2011-manual',
    title: 'Chevrolet — Manual do proprietário Astra 2011',
    url: 'https://meu.chevrolet.com.br/content/dam/gmownercenter/gmsa/gmbr/dynamic/manuals/2011/chevrolet/Astra/pt/om_ng-chevrolet_Astra_my11-pt_BR.pdf',
    modelYear: 2011,
    nature: 'manual',
    accessed: A,
    note: 'Dados técnicos do motor 2.0 Flexpower, transmissão F17, pneus, pesos e dimensões.',
  },
  'honda-civic-si-2008-manual': {
    id: 'honda-civic-si-2008-manual',
    title: 'Honda — Manual do proprietário Civic Si 2008',
    url: 'https://www.honda.com.br/pos-venda/automoveis/sites/customer_service/files/2017-05/Civic%20Si%202008_0-manual%20proprietario.pdf',
    modelYear: 2008,
    nature: 'manual',
    accessed: A,
    note: 'Especificações do K20Z3, câmbio de 6 marchas, pneus, pesos e dimensões.',
  },
  // ---- importer / press technical sheets
  'bmw-serie3-2013-ficha': {
    id: 'bmw-serie3-2013-ficha',
    title: 'BMW do Brasil — Ficha técnica Série 3 2013 (via UOL Carros)',
    url: 'https://download.uol.com.br/carros/bmw_serie_3_2013_ficha.pdf',
    modelYear: 2013,
    nature: 'technical-sheet',
    accessed: A,
    note: 'Ficha do importador: 320i (N20, 184 cv) e 335i (N55, 306 hp, 400 N·m de 1200 rpm), Aut/8, tração traseira, pesos, dimensões e rodas.',
  },
  'vw-jetta-2012-ficha': {
    id: 'vw-jetta-2012-ficha',
    title: 'Volkswagen do Brasil — Ficha técnica Jetta 2012 (via UOL Carros)',
    url: 'https://download.uol.com.br/carros/ficha_vw_jetta_2012.pdf',
    modelYear: 2012,
    nature: 'technical-sheet',
    accessed: A,
    note: 'Ficha do fabricante: Highline 2.0 TSI (EA888), DSG de 6 marchas, pesos, dimensões e desempenho declarado.',
  },
  'shopcar-208gt-2017': {
    id: 'shopcar-208gt-2017',
    title: 'Shopcar — Ficha técnica Peugeot 208 GT 1.6 THP 2017',
    url: 'https://www.shopcar.com.br/fichatecnica.php?id=1008',
    modelYear: 2017,
    nature: 'technical-sheet',
    accessed: A,
    note: 'Potência e torque do 1.6 THP, câmbio manual de 6 marchas, pesos e dimensões.',
  },
  'revistaauto-c200-2015': {
    id: 'revistaauto-c200-2015',
    title: 'Revista Auto — Ficha técnica Mercedes-Benz C200 Avantgarde 2.0 turbo 2015',
    url: 'https://www.revistaauto.com.br/ficha-tecnica-do-mercedes-benz-c200-avantgarde-2-0-turbo-2015/',
    modelYear: 2015,
    nature: 'technical-sheet',
    accessed: A,
    note: 'M274 2.0 turbo (184 cv, 300 N·m), 7G-TRONIC PLUS, pesos, dimensões e desempenho.',
  },
  'olhonocarro-golf-gti-2003': {
    id: 'olhonocarro-golf-gti-2003',
    title: 'Olho no Carro — Ficha técnica Volkswagen Golf GTI 1.8 turbo 2003',
    url: 'https://www.olhonocarro.com.br/catalogo/ficha-tecnica/volkswagen-golf-2003-gti-1-8-mi-180-193cv-turbo-4p-mec/',
    modelYear: 2003,
    nature: 'technical-sheet',
    accessed: A,
    note: 'Versão 180 cv (manual): potência, torque, pesos e dimensões. A mesma família EA113 1.8T equipa o A3 1.8T.',
  },
  'encycarpedia-evo-x': {
    id: 'encycarpedia-evo-x',
    title: 'Encycarpedia — Mitsubishi Lancer Evolution X sedã',
    url: 'https://www.encycarpedia.com/br/mitsubishi/08-lancer-evolution-x-seda',
    modelYear: '2008–2015',
    nature: 'technical-sheet',
    accessed: A,
    note: 'Página da geração (não só 2012): 4B11T 2.0 turbo, TC-SST, S-AWC, pesos e dimensões; a versão de 295 cv é a escolhida.',
  },
  'km77-335i-2013': {
    id: 'km77-335i-2013',
    title: 'km77 — BMW 335i (N55): datos técnicos',
    url: 'https://www.km77.com/coches/bmw/serie-3/2009/coupe/estandar/335i-xdrive-coupe3/datos',
    modelYear: 2009,
    nature: 'technical-sheet',
    accessed: A,
    note: 'OUTRA CARROCERIA E ANO (335i xDrive coupé, N55): usado só para diâmetro × curso e cilindrada do N55, iguais no F30.',
  },
  // ---- general literature (no specific URL consulted)
  'literature-ea113-18t': lit('literature-ea113-18t', 'Literatura técnica — VW/Audi EA113 1.8 20V turbo (AUM/AWP/BAM)', '1998–2006', 'Diâmetro × curso 81 × 86,4 mm, taxa 9,5:1, turbo K03/K04, ordem 1-3-4-2.'),
  'literature-audi-a3-8l-br': lit('literature-audi-a3-8l-br', 'Literatura técnica — Audi A3 8L 1.8T (mercado brasileiro)', '1999–2006', 'Carroceria 8L, pesos e câmbio 02M de 6 marchas da versão nacional.'),
  'literature-vw-02j': lit('literature-vw-02j', 'Literatura técnica — câmbio manual VW 02J (5 marchas)', '1998–2006', 'Relações do 02J do Golf Mk4 1.8T.'),
  'literature-vw-02m': lit('literature-vw-02m', 'Literatura técnica — câmbio manual VW/Audi 02M (6 marchas)', '1998–2006', 'Relações do 02M do A3 1.8T.'),
  'literature-prince-ep6': lit('literature-prince-ep6', 'Literatura técnica — PSA/BMW Prince EP6 1.6 THP', '2007–2017', 'Diâmetro × curso 77 × 85,8 mm, injeção direta, twin-scroll, ordem 1-3-4-2.'),
  'literature-bmw-n20': lit('literature-bmw-n20', 'Literatura técnica — BMW N20B20', '2011–2017', 'Diâmetro × curso 84 × 90,1 mm, taxa 10:1, twin-scroll, Valvetronic.'),
  'literature-bmw-n55': lit('literature-bmw-n55', 'Literatura técnica — BMW N55B30', '2009–2016', 'Seis em linha, ordem 1-5-3-6-2-4, taxa 10,2:1, biela 144,35 mm, turbo twin-scroll único.'),
  'literature-bmw-f30': lit('literature-bmw-f30', 'Literatura técnica — BMW Série 3 F30', '2012–2018', 'Distribuição de peso ≈ 50/50, altura do CG e áreas frontais estimadas.'),
  'literature-zf-8hp': lit('literature-zf-8hp', 'Literatura técnica — ZF 8HP (8HP45)', '2009–', 'Relações 4,714 / 3,143 / 2,106 / 1,667 / 1,285 / 1,000 / 0,839 / 0,667; conversor com lock-up.'),
  'literature-mercedes-m274': lit('literature-mercedes-m274', 'Literatura técnica — Mercedes-Benz M274 DE20', '2012–', 'Diâmetro × curso 83 × 92 mm, injeção direta, turbo único.'),
  'literature-mercedes-722-9': lit('literature-mercedes-722-9', 'Literatura técnica — 7G-TRONIC PLUS (722.9)', '2013–', 'Relações das 7 marchas e conversor com lock-up.'),
  'literature-k20z3': lit('literature-k20z3', 'Literatura técnica — Honda K20Z3 (Civic Si 8ª geração)', '2006–2011', 'i-VTEC com troca de came ≈ 5800 rpm, 86 × 86 mm, taxa 11:1.'),
  'literature-dq250': lit('literature-dq250', 'Literatura técnica — VW DSG DQ250 (6 marchas, embreagens úmidas)', '2003–', 'Relações e capacidade de torque do DSG de 6 marchas.'),
  'literature-4b11t': lit('literature-4b11t', 'Literatura técnica — Mitsubishi 4B11T', '2007–2016', 'Diâmetro × curso 86 × 86 mm, taxa 9,0:1, MIVEC duplo, bloco de alumínio.'),
  'literature-tc-sst': lit('literature-tc-sst', 'Literatura técnica — Mitsubishi TC-SST (W6DGA)', '2008–2015', 'Dupla embreagem de 6 marchas: relações e diferencial.'),
  'literature-s-awc': lit('literature-s-awc', 'Literatura técnica — Mitsubishi S-AWC (ACD/AYC)', '2008–2015', 'Diferencial central com acoplamento controlado (ACD).'),
  // ---- documented estimates
  'estimate-chapter2-aero': {
    id: 'estimate-chapter2-aero',
    title: 'Estimativa do projeto — aerodinâmica e massas não publicadas',
    url: '',
    modelYear: '—',
    nature: 'literature',
    accessed: A,
    note: 'Cx, área frontal, altura do CG e inércias estimados por carroceria semelhante quando a ficha não publica; marcados como "estimated" no código.',
  },
  'estimate-chapter2-gearing': {
    id: 'estimate-chapter2-gearing',
    title: 'Estimativa do projeto — relações não publicadas',
    url: '',
    modelYear: '—',
    nature: 'literature',
    accessed: A,
    note: 'Relação ou detalhe de câmbio sem fonte direta, deduzido do câmbio da mesma família e da velocidade por marcha publicada.',
  },
};
