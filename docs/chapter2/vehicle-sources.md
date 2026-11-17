# Fontes dos veículos — Capítulo 2

O registro no código fica em `src/data/cars/chapter2/sources.ts` (`CHAPTER2_SOURCES`). Cada carro e cada motor do capítulo lista as fontes que usa (`sources`) e marca a natureza de cada campo:

- **factory**: manual ou ficha do fabricante/importador;
- **secondary**: ficha de imprensa ou literatura técnica;
- **estimated**: estimativa de engenharia.

O teste `tests/unit/vehicles/chapter2.test.ts` falha nestes casos:

- alguma fonte citada não está registrada;
- um manual ou ficha técnica não tem URL `https://`.

Acessos em 2026-11-16. As carrocerias são desenhos próprios e o jogo não embute foto nem logotipo de terceiros.

## Documentos consultados (com URL)

| Id | Documento | Natureza | Usado em |
|---|---|---|---|
| `gm-astra-2011-manual` | [Chevrolet — Manual do proprietário Astra 2011](https://meu.chevrolet.com.br/content/dam/gmownercenter/gmsa/gmbr/dynamic/manuals/2011/chevrolet/Astra/pt/om_ng-chevrolet_Astra_my11-pt_BR.pdf) | manual | Astra e motor Família II 2.0 |
| `honda-civic-si-2008-manual` | [Honda — Manual do proprietário Civic Si 2008](https://www.honda.com.br/pos-venda/automoveis/sites/customer_service/files/2017-05/Civic%20Si%202008_0-manual%20proprietario.pdf) | manual | Civic Si e K20Z3 |
| `bmw-serie3-2013-ficha` | [BMW do Brasil — Ficha técnica Série 3 2013 (UOL Carros)](https://download.uol.com.br/carros/bmw_serie_3_2013_ficha.pdf) | ficha técnica | 320i, 335i, N20, N55 |
| `vw-jetta-2012-ficha` | [Volkswagen — Ficha técnica Jetta 2012 (UOL Carros)](https://download.uol.com.br/carros/ficha_vw_jetta_2012.pdf) | ficha técnica | Jetta e EA888 |
| `shopcar-208gt-2017` | [Shopcar — Peugeot 208 GT 1.6 THP 2017](https://www.shopcar.com.br/fichatecnica.php?id=1008) | ficha técnica | 208 GT e Prince THP |
| `revistaauto-c200-2015` | [Revista Auto — Mercedes-Benz C200 Avantgarde 2015](https://www.revistaauto.com.br/ficha-tecnica-do-mercedes-benz-c200-avantgarde-2-0-turbo-2015/) | ficha técnica | C200 e M274 |
| `olhonocarro-golf-gti-2003` | [Olho no Carro — Golf GTI 1.8 turbo 2003](https://www.olhonocarro.com.br/catalogo/ficha-tecnica/volkswagen-golf-2003-gti-1-8-mi-180-193cv-turbo-4p-mec/) | ficha técnica | Golf GTI e EA113 (também no A3) |
| `encycarpedia-evo-x` | [Encycarpedia — Lancer Evolution X sedã](https://www.encycarpedia.com/br/mitsubishi/08-lancer-evolution-x-seda) | ficha técnica | Evo X e 4B11T. Página da geração 2008–2015, não só de 2012. |
| `km77-335i-2013` | [km77 — BMW 335i (N55)](https://www.km77.com/coches/bmw/serie-3/2009/coupe/estandar/335i-xdrive-coupe3/datos) | ficha técnica | **Outra carroceria e outro ano** (335i xDrive coupé 2009). Usada só para diâmetro × curso e cilindrada do N55, iguais no F30. |

## Literatura técnica geral (sem URL específica)

Para os itens abaixo, o projeto **não** consultou um endereço específico. São referências gerais: material de imprensa do fabricante, literatura de oficina e textos de engenharia. Por isso, os valores tirados delas aparecem como `secondary` ou `estimated` no código, nunca como `factory`.

- EA113 1.8T: 81 × 86,4 mm, 9,5:1.
- Audi A3 8L nacional.
- Câmbios VW 02J e 02M.
- Prince EP6: 77 × 85,8 mm.
- BMW N20: 84 × 90,1 mm, 10:1.
- BMW N55: ordem 1-5-3-6-2-4, 10,2:1.
- Plataforma F30.
- ZF 8HP, com relações 4,714 … 0,667, iguais às do código.
- Mercedes M274: 83 × 92 mm.
- 7G-TRONIC PLUS.
- K20Z3: troca de came ≈ 5800 rpm, 86 × 86 mm, 11:1.
- DSG DQ250.
- 4B11T: 86 × 86 mm, 9,0:1.
- TC-SST.
- S-AWC/ACD.

Estimativas declaradas do projeto:

- `estimate-chapter2-aero`: Cx, área frontal, CG e inércias não publicados;
- `estimate-chapter2-gearing`: relações sem fonte direta.

## Carro a carro

| Carro | Fontes | Principais campos estimados |
|---|---|---|
| Chevrolet Astra 2.0 Flexpower 2011 | manual GM | Cx, área frontal, pontos intermediários da curva de torque, 0–100 (o manual não publica) |
| Peugeot 208 GT 1.6 THP 2017 | Shopcar, literatura Prince, estimativa de relações | Cx, área frontal, relações e diferencial |
| VW Golf GTI 1.8T 2003 | Olho no Carro, literatura 02J/EA113 | área frontal, relações e diferencial |
| Audi A3 1.8T 2005 | literatura A3 8L/02M/EA113, estimativa aerodinâmica | área frontal, relações, diferencial, 0–100. **É o carro com menos documentação direta**: sem ficha nacional consultada por URL. |
| Mercedes-Benz C200 W205 2015 | Revista Auto, literatura M274/722.9 | diferencial, conversor de torque |
| BMW 320i F30 2014 | ficha BMW do Brasil, literatura F30/ZF 8HP/N20 | área frontal, diferencial, conversor de torque |
| Honda Civic Si 2008 | manual Honda, literatura K20Z3 | área frontal, perfil dos ressaltos altos do i-VTEC |
| VW Jetta Highline TSI 2012 | ficha VW do Brasil, literatura DQ250 | só os pontos intermediários da curva de torque |
| Mitsubishi Lancer Evolution X 2012 | Encycarpedia, literatura TC-SST/S-AWC/4B11T | área frontal, torque de travamento do ACD |
| BMW 335i M Sport F30 2013 | ficha BMW do Brasil, km77 (N55), literatura F30/ZF 8HP/N55 | área frontal, diferencial, conversor de torque |

Os picos de potência e torque, com as rotações, vêm sempre da fonte do motor e são verificados no dinamômetro (ver `mechanical-calibration.md`). Os pontos intermediários da curva de torque são reconstruídos pela simulação a partir da geometria e do mapa de turbo, por isso aparecem como estimados.
