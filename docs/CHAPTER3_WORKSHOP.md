# Oficina Stage 3 — Motor Build & Customization (Capítulo 3)

Relatório do que foi implementado e medido. Números gerados por `npx tsx scripts/chapter3-workshop-report.ts` (pista de testes, piloto ideal, resolver v2).

## Regra central
"Stage" é só o nome de um grupo de peças. O projeto do motor é **derivado** das peças instaladas (`EngineProjectClassifier.ts`); não existe variável de estágio nem multiplicador de potência. Todo ganho vem de fluxo, eficiência volumétrica, pressão, atrito, transmissão e aderência. A ficha do catálogo nunca é alterada: `factoryInduction` (ficha) e `currentInduction` (hardware instalado) são derivados em `ConvertedTurboModel.inductionState`.

## Módulos
- `chapter3Stage3Parts.ts`: ~50 peças (ECU aspirada Stage 2/Competition por família, admissão dupla, coletores, escape de competição, cabeçotes, comandos/VVEL/VVT-i, molas, pistões/bielas/kits forjados, balanceamento, lubrificação, combustível, 10 kits de conversão turbo + Twin VQ37, turbinas híbridas S3/High Flow, ECU biturbo Competition, intercooler, coletor de turbo, internos Stage 3, pressão por marcha, embreagem/DCT/AT reforçados).
- `FuelSystemModel.ts`: capacidade de injetores/bomba/bomba de alta pressão derivada da curva de fábrica (potência × BSFC × margem). Rejeita o build com a potência que sustenta.
- `LubricationModel.ts`: margem de vazão da bomba e de troca térmica contra torque, giro e calor do novo motor; vida no limite cai com margem²; abaixo de 68 % o build é recusado.
- `ConvertedTurboModel.ts`: indução efetiva, compressão máxima do kit, limite de internos (tolerância 12 %), fluxo do compressor (`compressorFlowKgS` no `breathingModel`).
- `ProjectRequirements.ts`: presets por carro (validados por teste nos 8 carros), `applyPreset` e `PROJECT_CATEGORIES`.
- `ProjectLimitations.ts`: gargalos **medidos** (combustível, óleo, internos, transmissão, giro).
- Twin turbo usa o `layout: 'parallel-twin'` que a física e o áudio já tinham (dois rotores, dois apitos). Pressão por marcha: `transmission.boostByGear` limita a pressão no `Turbocharger`.
- Controller: `planBundle`, `buyBundle` (atômico), `applyPreset` (troca de escola sem perder peças: o que sai vai ao estoque e volta de graça).
- Desbloqueios: evento 1 `c3-v6-parts`; 2 `c3-na-head`; 4 `c3-na-high-rpm`; 5 `c3-stage3` + `c3-turbo-street`; 7 `c3-high-flow`; 9 `c3-competition`. Calculados do histórico (`unlocksOf`), então saves antigos recebem sem migração. O save não ganhou campos novos.

## Compatibilidade
- Kits de conversão: só no motor para o qual foram feitos (VQ35DE, 2GR-FSE, VQ37VHR); ECU aspirada Stage 2 é só aspirada; peças do turbo de fábrica (ECU Stage 1/2/3, turbina híbrida, controle de pressão, peças biturbo) não servem em conversão (`compat.factoryTurbo`).
- 2GR-FSE: pistões de alta compressão recusados (11,8:1 + 0,8 > 12,5:1); injeção direta limitada pela bomba de alta pressão (D-4S com injetores de porta tem folga maior); kit aceita +0,6 de compressão pela refrigeração da carga.
- Câmbio: embreagem/DCT/AT precisam suportar o torque, senão o build é recusado com o número.

## Resultados medidos
| Carro | Projeto | cv | N·m | 0–100 s | 201 m s | 402 m s | km/h 402 | combustível | óleo | vida no limite s |
|---|---|---|---|---|---|---|---|---|---|---|
| nissan-350z-2006 | original | 304 | 353 | 5,79 | 9,37 | 14,10 | — | — | 115 % | 2,6 |
| nissan-350z-2006 | na-street | 323 | 368 | 5,58 | 9,23 | 13,86 | — | — | 111 % | 2,6 |
| nissan-350z-2006 | na-high-rpm | 386 | 422 | 5,29 | 9,02 | 13,41 | — | — | 99 % | 3,1 |
| nissan-350z-2006 | na-competition | 431 | 467 | 5,08 | 8,86 | 13,11 | — | — | 121 % | 4,5 |
| nissan-350z-2006 | turbo-street | 418 | 477 | 5,36 | 8,91 | 13,22 | — | 102 % | 123 % | 3,9 |
| nissan-350z-2006 | turbo-balanced | 487 | 554 | 5,25 | 8,81 | 12,94 | — | 128 % | 105 % | 3,9 |
| nissan-350z-2006 | turbo-high-flow | 620 | 690 | 5,09 | 8,58 | 12,45 | — | 101 % | 128 % | 3,9 |
| lexus-is350-2015 | original | 312 | 376 | 5,93 | 9,38 | 14,07 | — | — | 115 % | 2,7 |
| lexus-is350-2015 | na-street | 333 | 392 | 6,77 | 9,90 | 14,57 | — | — | 110 % | 2,7 |
| lexus-is350-2015 | na-high-rpm | 362 | 404 | 6,70 | 9,85 | 14,43 | — | — | 108 % | 3,2 |
| lexus-is350-2015 | na-competition | 378 | 414 | 6,60 | 9,76 | 14,29 | — | — | 138 % | 4,7 |
| lexus-is350-2015 | turbo-street | 417 | 491 | 5,32 | 8,91 | 13,24 | — | 105 % | 126 % | 4,0 |
| lexus-is350-2015 | turbo-balanced | 470 | 552 | 5,54 | 9,03 | 13,24 | — | 136 % | 112 % | 4,0 |
| lexus-is350-2015 | turbo-high-flow | 600 | 688 | 5,09 | 8,63 | 12,56 | — | 107 % | 134 % | 4,0 |
| nissan-370z-2014 | original | 337 | 366 | 5,34 | 9,07 | 13,63 | — | — | 115 % | 2,4 |
| nissan-370z-2014 | na-street | 358 | 382 | 5,21 | 8,97 | 13,44 | — | — | 111 % | 2,4 |
| nissan-370z-2014 | na-high-rpm | 409 | 414 | 5,00 | 8,80 | 13,10 | — | — | 104 % | 2,9 |
| nissan-370z-2014 | na-competition | 471 | 470 | 4,84 | 8,66 | 12,80 | — | — | 124 % | 4,1 |
| nissan-370z-2014 | turbo-street | 446 | 492 | 5,07 | 8,68 | 12,86 | — | 106 % | 125 % | 3,6 |
| nissan-370z-2014 | turbo-balanced | 532 | 564 | 5,03 | 8,60 | 12,63 | — | 130 % | 107 % | 3,6 |
| nissan-370z-2014 | turbo-high-flow | 680 | 705 | 4,92 | 8,42 | 12,19 | — | 102 % | 129 % | 3,6 |
| nissan-370z-2014 | turbo-twin-competition | 664 | 688 | 4,94 | 8,43 | 12,23 | — | 104 % | 131 % | 4,1 |
| mercedes-amg-c43-2017 | original | 367 | 521 | 4,33 | 8,19 | 12,61 | — | — | 115 % | 3,0 |
| mercedes-amg-c43-2017 | biturbo-stage1 | 426 | 578 | 3,87 | 7,86 | 12,07 | — | — | 108 % | 3,0 |
| mercedes-amg-c43-2017 | biturbo-stage2 | 468 | 666 | 3,57 | 7,59 | 11,67 | — | — | 98 % | 4,3 |
| mercedes-amg-c43-2017 | biturbo-stage3 | 577 | 796 | 3,31 | 7,31 | 11,13 | — | 110 % | 86 % | 3,3 |
| mercedes-amg-c43-2017 | biturbo-competition | 608 | 837 | 3,28 | 7,25 | 11,01 | — | 114 % | 145 % | 5,9 |
| kia-stinger-gt-2019 | original | 370 | 510 | 4,88 | 8,56 | 13,13 | — | — | 115 % | 3,0 |
| kia-stinger-gt-2019 | biturbo-stage1 | 439 | 561 | 4,43 | 8,23 | 12,56 | — | — | 109 % | 3,0 |
| kia-stinger-gt-2019 | biturbo-stage2 | 474 | 653 | 3,83 | 7,80 | 11,99 | — | — | 98 % | 4,3 |
| kia-stinger-gt-2019 | biturbo-stage3 | 591 | 785 | 3,53 | 7,52 | 11,44 | — | 108 % | 85 % | 3,2 |
| kia-stinger-gt-2019 | biturbo-competition | 624 | 826 | 3,60 | 7,54 | 11,41 | — | 112 % | 144 % | 5,9 |
| maserati-ghibli-sq4-2015 | original | 410 | 551 | 4,58 | 8,38 | 12,79 | — | — | 115 % | 3,2 |
| maserati-ghibli-sq4-2015 | biturbo-stage1 | 474 | 612 | 4,08 | 8,00 | 12,20 | — | — | 108 % | 3,2 |
| maserati-ghibli-sq4-2015 | biturbo-stage2 | 522 | 705 | 3,61 | 7,64 | 11,69 | — | — | 98 % | 4,6 |
| maserati-ghibli-sq4-2015 | biturbo-stage3 | 632 | 844 | 3,41 | 7,41 | 11,23 | — | 112 % | 87 % | 3,7 |
| maserati-ghibli-sq4-2015 | biturbo-competition | 666 | 888 | 3,43 | 7,40 | 11,18 | — | 116 % | 144 % | 6,3 |
| alfa-giulia-qv-2017 | original | 512 | 601 | 4,09 | 7,93 | 11,85 | — | — | 115 % | 3,3 |
| alfa-giulia-qv-2017 | biturbo-stage1 | 587 | 691 | 4,06 | 7,83 | 11,59 | — | — | 106 % | 3,3 |
| alfa-giulia-qv-2017 | biturbo-stage2 | 655 | 769 | 4,01 | 7,71 | 11,35 | — | — | 98 % | 4,7 |
| alfa-giulia-qv-2017 | biturbo-stage3 | 767 | 889 | 3,82 | 7,48 | 10,96 | — | 115 % | 90 % | 4,0 |
| alfa-giulia-qv-2017 | biturbo-competition | 810 | 938 | 3,85 | 7,46 | 10,90 | — | 119 % | 147 % | 6,5 |
| nissan-gtr-r35-2015 | original | 553 | 628 | 3,50 | 7,52 | 11,51 | — | — | 115 % | 3,6 |
| nissan-gtr-r35-2015 | biturbo-stage1 | 647 | 748 | 3,22 | 7,28 | 11,18 | — | — | 104 % | 3,6 |
| nissan-gtr-r35-2015 | biturbo-stage2 | 707 | 804 | 3,00 | 7,03 | 10,67 | — | — | 98 % | 5,2 |
| nissan-gtr-r35-2015 | biturbo-stage3 | 871 | 978 | 2,77 | 6,91 | 10,39 | — | 109 % | 86 % | 4,0 |
| nissan-gtr-r35-2015 | biturbo-competition | 919 | 1032 | 2,90 | 6,85 | 10,32 | — | 152 % | 143 % | 7,0 |

## Metas exploratórias × modelo
Metas do plano (cv): C43 420–560, Stinger 425–550, Ghibli 460–600, Giulia 560–690, GT-R 620–780; 350Z turbo 390–540, Lexus 390–500, 370Z 420–600; aspirados avançados 325–405. O modelo passa de várias: o Stage 3 que já existia (`ecu-stage3`, +0,8 bar) leva o GT-R a ~870 cv, e os Competition ficam entre ~600 e ~920 cv nos biturbos; 350Z High Flow ~620 cv e Lexus ~550 cv. Nenhuma peça antiga foi alterada para encaixar nas metas e nenhum torque foi inventado; as metas devem ser revistas ou as peças do Capítulo 2/3 recalibradas.

## Limitações conhecidas
- Valores de lubrificação (frações de calor do óleo), margens de combustível e BSFC são **estimativas**.
- LSD não foi implementado (a simulação tem 1 DOF por eixo, sem diferença entre rodas). Não há `AdvancedBreathingModel`: VVEL/VVT-i são modelados como eventos de válvula no `breathingModel`.
- Lexus IS350 (automático): projetos aspirados medem 0–402 m **mais lentos** que o original apesar de mais potência (o mesmo ocorre com `filter-sport`, já antes desta expansão): problema do escalonamento do automático ao subir o corte, a investigar.
- `parts-gain-report`: `forged-v6-turbo` e `boost-by-gear` são isentos (ver `GAIN_EXEMPT`); peças genéricas/antigas dos carros do Capítulo 3 (pneus, radiador, downpipe no C43 etc.) falham a auditoria e não foram tratadas aqui.
- Não implementados: aba ESTÉTICA E PERSONALIZAÇÃO, comparação A/B de projetos no Dyno, estimativas 1000 m, áudio específico por preparação (o Twin já usa os dois rotores existentes), e2e do plano.
