# Fontes dos veículos — Capítulo 3 (Elite da Madrugada)

O registro no código fica em `src/data/cars/chapter3/sources.ts` (`CHAPTER3_SOURCES`). Cada carro e cada motor lista as fontes que usa (`sources`) e marca a natureza de cada campo em `*_PROVENANCE`:

- **factory**: documento do fabricante (press kit, página de especificações);
- **secondary**: ficha técnica independente (Auto-Data, Kelley Blue Book, Encycarpedia, Motor Matchup);
- **derived**: calculado de outros valores documentados;
- **estimated**: estimativa de engenharia, sem documento consultado;
- **calibrated**: ajustado para reproduzir um comportamento documentado.

Acessos em 2026-11-17. Os testes (`tests/unit/vehicles/chapter3.test.ts`) falham se uma fonte citada não estiver registrada ou se um documento consultado não tiver URL `https://`.

## Unidades: hp, cv e kW não são a mesma coisa

As fichas publicam **hp** (SAE), **PS** ("Hp" do Auto-Data), **lb-ft**, libras e polegadas. O projeto converte tudo em `src/data/provenance.ts`:

| Conversão | Fator | Exemplo |
|---|---|---|
| hp → cv (métrico) | × 1,01387 (`hpToCv`) | 300 hp = 304,2 cv |
| hp → kW | × 0,7457 (`hpToKw`) | 300 hp = 223,7 kW |
| lb-ft → N·m | × 1,35582 (`lbftToNm`) | 260 lb-ft = 352,5 N·m |

Cada `EngineDoc` guarda o valor publicado (`published: { hp, lbFt }`) e o valor convertido que a simulação usa, e o teste confere que um vem do outro. (O Capítulo 2 usou hp como cv na 335i; a diferença de 1,4 % está dentro da tolerância e não foi alterada.)

## Documentos consultados

| Id | Documento | O que trouxe |
|---|---|---|
| `nissan-350z-2006-presskit` | [Nissan — press kit do 350Z 2006](https://usa.nissannews.com/en-US/releases/2006-nissan-350z-coupe-and-roadster-press-kit) | VQ35DE 3,5 L, 300 hp, 260 lb-ft, corte 7.000 rpm, entre-eixos 104,3 in, Cd 0,30, pneus. **Não** traz diâmetro × curso, taxa, relações nem massa. |
| `nissan-370z-2014-presskit` | [Nissan — press kit do 370Z 2014](https://usa.nissannews.com/en-US/releases/us-2014-nissan-370z-coupe-press-kit) | 95,5 × 86 mm, 11:1, 332 hp @ 7.000, 270 lb-ft @ 5.200, giro máximo 7.500, as seis relações e o final 3,692, 3.278 lb, dimensões, pneus, Cd 0,30. |
| `lexus-is-2015-pressroom` | [Lexus — release da linha IS 2015](https://pressroom.lexus.com/lexus-2015-is-models-product-news-release/) | V6 3,5 L de 306 hp e 277 lb-ft, automático de 8 marchas. Sem diâmetro × curso, relações, massa. |
| `mbusa-c43-2017` | [Mercedes-Benz USA — AMG C 43 2017](https://media.mbusa.com/news/2017-mercedes-amg-c43-sedan-specifications) | 88,0 × 82,1 mm, 10,5:1, 362 hp @ 5.500–6.000, 384 lb-ft @ 2.000–4.200, corte 6.550; **as nove relações** e o final 3,07; 4MATIC 31:69; 3.759 lb; dimensões; pneus; 0–60 mph 4,6 s. |
| `nissan-gtr-2015-presskit` | [Nissan — press kit do GT-R 2015](https://usa.nissannews.com/en-US/releases/us-2015-nissan-gt-r-press-kit) | 95,5 × 88,4 mm, 9,0:1, 545 hp @ 6.400, 463 lb-ft @ 3.200–5.800, giro máximo 7.000, seis relações e final 3,700, ATTESA 0:100 a 50:50, 3.851 lb, dimensões, Cd 0,26, pneus. |
| `alfa-giulia-qv-2017-specs` | [Fiat 500 USA — planilha da Giulia Quadrifoglio 2017](https://www.fiat500usa.com/2015/11/2017-alfa-giulia-qv-specifications.html) | **Planilha preliminar** do carro europeu de pré-produção com câmbio manual: 86,5 × 82 mm, 9,3:1, 505 hp @ 6.500, 443 lb-ft @ 2.500–5.500, corte 6.500 / máximo 7.250, 1.524 kg, dimensões, Cd 0,32, pneus, 0–60 mph em 3,8 s. |
| `autodata-lexus-is350-2015` | [Auto-Data — Lexus IS 350](https://www.auto-data.net/en/lexus-is-iii-xe30-350-v6-306hp-direct-shift-53751) | 94 × 83 mm, 11,8:1, 1.630 kg, dimensões, Cd 0,28. Página europeia. |
| `autodata-stinger-gt-2019` | [Auto-Data — Kia Stinger GT](https://auto-data.net/en/kia-stinger-gt-3.3-gdi-366hp-awd-automatic-36044) | 92 × 83,8 mm, 10:1, 366 PS, 510 N·m, 1.858–1.905 kg, dimensões, pneus, 0–100 em 5,5 s. Página europeia. |
| `kbb-ghibli-2015` | [Kelley Blue Book — Ghibli 2015](https://www.kbb.com/maserati/ghibli/2015/specs/) | 404 hp @ 5.500, 406 lb-ft (lido no resumo da busca). |
| `autodata-ghibli-s-q4` | [Auto-Data — Ghibli S Q4](https://www.auto-data.net/en/maserati-ghibli-iii-m157-s-q4-3.0-v6-410hp-awd-automatic-22819) | 86,5 × 84,5 mm, 9,7:1, 550 N·m, 1.870 kg, dimensões, pneus, 0–100 em 4,8 s. Sem Cd. |
| `autodata-giulia-qv-2017` | [Auto-Data — Giulia Quadrifoglio](https://www.auto-data.net/en/alfa-romeo-giulia-952-quadrifoglio-2.9-v6-510hp-automatic-32065) | Confirma 86,5 × 82 mm, 9,3:1, 600 N·m, entre-eixos, 0–100 em 3,9 s. Sem massa nem Cd. |
| `encycarpedia-350z-2006` | [Encycarpedia — 350Z 2006](https://www.encycarpedia.com/nissan/06-350z-coupe) | 95,5 × 81,4 mm e 10,3:1 (resumo da busca; a página inteira devolveu 403 em outra língua). |
| `motormatchup-350z-2006` | [Motor Matchup — 350Z 2006 manual](https://www.motormatchup.com/catalog/Nissan/350Z/2006/Touring-(6_speed-Manual)) | 1ª 3,794, 6ª 0,794, final 3,538 e massa de ≈ 3.346–3.370 lb (resumo da busca). |
| `wikipedia-alfa-690t` | [Wikipedia — Alfa Romeo 690T](https://en.wikipedia.org/wiki/Alfa_Romeo_690T_engine) | Três moentes a 120° com duas bielas cada: **disparo irregular 90°/150°**, 240° por bancada, 1ª-ordem 1,5. A ordem de ignição difere entre as fontes (1-6-3-4-2-5 e 1-6-3-4-5-2): usa-se a primeira. |
| `kia-stinger-2019-brochure` | [Kia — brochura do Stinger 2019](https://www.kia.com/content/dam/kia/us/brochures/brochure_stinger_2019.pdf) | Aberta, mas o PDF não tem texto extraível: **nenhum valor foi tirado dela.** |

## Literatura geral e estimativas (sem URL consultada)

Entradas `literature-*` são referências gerais que o projeto **não** consultou num endereço específico (ordens de ignição 1-2-3-4-5-6 dos VQ/2GR/VR38, 1-4-3-6-2-5 do M276, biela estimada de cada motor, características do Q4, ATTESA, 4MATIC, câmbios Aisin e Hyundai de oito marchas). Os valores tirados delas são marcados como `secondary` ou `estimated`. `estimate-chapter3-aero` e `estimate-chapter3-gearing` cobrem Cx, área frontal, CG, inércias, relações e finais que nenhuma ficha consultada publica.

## Carro a carro

| Carro | Dados de fábrica | Principais campos estimados |
|---|---|---|
| Nissan 350Z Coupé 2006 | potência, torque, corte, entre-eixos, Cd | massa (3 fontes discordam), área frontal, relações intermediárias (vêm do mesmo câmbio do 370Z), 0–100 |
| Lexus IS 350 F Sport 2015 | potência e torque (release), câmbio de 8 marchas | **relações e final do câmbio**, conversor, área frontal; massa e Cd vêm de uma ficha europeia |
| Nissan 370Z Coupé 2014 | quase tudo: motor, relações, final, massa, dimensões, Cd | área frontal, 0–100 |
| Mercedes-AMG C 43 2017 | motor, **nove relações**, final, 4MATIC 31:69, massa, dimensões, pneus | Cd, pressão do turbo, conversor |
| Kia Stinger GT 2019 | só pela ficha europeia (Auto-Data); brochura ilegível | **relações e final**, repartição AWD, Cd, pressão do turbo |
| Maserati Ghibli S Q4 2015 | potência, torque, massa, dimensões, pneus (KBB e Auto-Data) | relações, final, repartição Q4, Cd, ordem de ignição, pressão do turbo |
| Alfa Romeo Giulia Quadrifoglio 2017 | motor, dimensões, Cd, pneus (planilha preliminar com câmbio manual) | **massa do automático**, relações, final, pressão do turbo |
| Nissan GT-R R35 2015 | motor, relações, final, massa, dimensões, Cd, pneus | repartição estática e acoplamento do ATTESA, pressão dos turbos, 0–100 |

Os picos de potência e torque vêm sempre da fonte do motor e são verificados no dinamômetro (ver `mechanical-calibration.md`). A curva entre os pontos publicados é reconstruída pela simulação a partir da geometria e do mapa do turbo, por isso aparece como estimada.
