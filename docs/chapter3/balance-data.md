# Balanceamento — Capítulo 3 (gerado por scripts/balance-chapter3.ts)

## Builds (pista de testes, piloto avançado)

| carro | build | custo | cv | N·m | boost máx. | 0–100 | 201 m | 402 m | vel. 402 m | patinagem | trocas | câmbio |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| nissan-350z-2006 | original | 0 | 304 | 353 | — | 5.79 | 9.37 | 14.10 | 254 km/h | 0.67 s | 5 | manual |
| nissan-350z-2006 | pneus + embreagem | 2500 | 304 | 353 | — | 5.56 | 9.17 | 13.89 | 254 km/h | 0.69 s | 5 | manual |
| nissan-350z-2006 | preparado | 9900 | 312 | 357 | — | 5.48 | 8.94 | 13.55 | 264 km/h | 0.73 s | 5 | manual |
| lexus-is350-2015 | original | 0 | 312 | 376 | — | 5.93 | 9.38 | 14.07 | 256 km/h | 1.09 s | 8 | torque-converter-auto |
| lexus-is350-2015 | pneus | 1600 | 312 | 376 | — | 5.59 | 9.09 | 13.77 | 257 km/h | 0.69 s | 6 | torque-converter-auto |
| lexus-is350-2015 | preparado | 11900 | 323 | 382 | — | 5.17 | 8.77 | 13.35 | 262 km/h | 0.87 s | 6 | torque-converter-auto |
| nissan-370z-2014 | original | 0 | 337 | 366 | — | 5.34 | 9.07 | 13.63 | 266 km/h | 1.23 s | 5 | manual |
| nissan-370z-2014 | pneus + embreagem | 2500 | 337 | 366 | — | 5.10 | 8.85 | 13.40 | 267 km/h | 0.63 s | 5 | manual |
| nissan-370z-2014 | preparado | 9900 | 345 | 371 | — | 5.12 | 8.71 | 13.16 | 275 km/h | 0.53 s | 5 | manual |
| mercedes-amg-c43-2017 | original | 0 | 367 | 521 | — | 4.33 | 8.19 | 12.61 | 275 km/h | 0.16 s | 6 | torque-converter-auto |
| mercedes-amg-c43-2017 | Stage 1 | 2500 | 417 | 578 | 1.20 bar | 3.92 | 7.89 | 12.12 | 289 km/h | 0.21 s | 7 | torque-converter-auto |
| mercedes-amg-c43-2017 | Stage 2 preparado | 28600 | 468 | 666 | 1.45 bar | 3.44 | 7.49 | 11.53 | 306 km/h | 0.17 s | 7 | torque-converter-auto |
| kia-stinger-gt-2019 | original | 0 | 370 | 510 | — | 4.88 | 8.56 | 13.13 | 262 km/h | 0.01 s | 6 | torque-converter-auto |
| kia-stinger-gt-2019 | Stage 1 | 2500 | 430 | 561 | 1.20 bar | 4.46 | 8.26 | 12.62 | 279 km/h | 0.01 s | 6 | torque-converter-auto |
| kia-stinger-gt-2019 | Stage 2 preparado | 28600 | 474 | 653 | 1.45 bar | 3.77 | 7.74 | 11.90 | 294 km/h | 0.01 s | 6 | torque-converter-auto |
| maserati-ghibli-sq4-2015 | original | 0 | 410 | 551 | — | 4.58 | 8.38 | 12.79 | 273 km/h | 0.00 s | 6 | torque-converter-auto |
| maserati-ghibli-sq4-2015 | Stage 1 | 2500 | 464 | 612 | 1.25 bar | 4.08 | 8.01 | 12.24 | 288 km/h | 0.00 s | 6 | torque-converter-auto |
| maserati-ghibli-sq4-2015 | Stage 2 preparado | 28600 | 522 | 705 | 1.50 bar | 3.56 | 7.58 | 11.61 | 304 km/h | 0.01 s | 6 | torque-converter-auto |
| alfa-giulia-qv-2017 | original | 0 | 512 | 601 | — | 4.09 | 7.93 | 11.85 | 310 km/h | 1.22 s | 7 | torque-converter-auto |
| alfa-giulia-qv-2017 | Stage 1 | 2500 | 576 | 681 | 1.50 bar | 4.04 | 7.83 | 11.61 | 323 km/h | 1.36 s | 7 | torque-converter-auto |
| alfa-giulia-qv-2017 | Stage 2 preparado | 28000 | 655 | 769 | 1.75 bar | 2.96 | 6.94 | 10.50 | 341 km/h | 0.67 s | 7 | torque-converter-auto |
| nissan-gtr-r35-2015 | original | 0 | 553 | 628 | — | 3.50 | 7.52 | 11.51 | 304 km/h | 0.20 s | 5 | dual-clutch |
| nissan-gtr-r35-2015 | Stage 1 | 2500 | 630 | 732 | 1.30 bar | 3.26 | 7.32 | 11.24 | 304 km/h | 0.25 s | 5 | dual-clutch |
| nissan-gtr-r35-2015 | Stage 2 preparado | 31700 | 707 | 804 | 1.55 bar | 2.68 | 6.75 | 10.39 | 313 km/h | 0.13 s | 5 | dual-clutch |

## Rivais

- 1. A Volta do GTI — Ricardo "GTI": Volkswagen Golf GTI 1.8T 2003 (preparado), 230 cv, 301 N·m, 1291 kg, 0–100 5.86 s, 402 m 14.21 s, peças [ecu-stage2, downpipe-catless, intercooler-race, intake-direct-turbo, pistons-forged-modern, clutch-reinforced, tires-slick, suspension-drag-fwd, weight-medium, flywheel-light-modern, differential-short], RT médio 0.19 s, prêmio 15000 CR — original: 180 cv, 235 N·m
- 2. Primeira Elite — Hugo "Z": Nissan 350Z Coupé 2006, 304 cv, 353 N·m, 1595 kg, 0–100 5.79 s, 402 m 14.10 s, peças [original], RT médio 0.22 s, prêmio 20000 CR
- 3. Silêncio Refinado — Renata "Silêncio": Lexus IS 350 F Sport 2015, 312 cv, 376 N·m, 1705 kg, 0–100 5.93 s, 402 m 14.07 s, peças [original], RT médio 0.21 s, prêmio 26000 CR
- 4. Zeta de Verdade — Bruno "Zeta": Nissan 370Z Coupé 2014, 337 cv, 366 N·m, 1562 kg, 0–100 5.34 s, 402 m 13.63 s, peças [original], RT médio 0.2 s, prêmio 32000 CR
- 5. Peso Pesado — Davi "Stinger": Kia Stinger GT 2019 AWD, 370 cv, 510 N·m, 1935 kg, 0–100 4.88 s, 402 m 13.13 s, peças [original], RT médio 0.18 s, prêmio 40000 CR
- 6. Salão Italiano — Valentina "Salão": Maserati Ghibli S Q4 2015, 410 cv, 551 N·m, 1945 kg, 0–100 4.58 s, 402 m 12.79 s, peças [original], RT médio 0.17 s, prêmio 48000 CR
- 7. Biturbo Alemão — Maya "Três-Mais": Mercedes-AMG C 43 4MATIC 2017, 367 cv, 521 N·m, 1780 kg, 0–100 4.33 s, 402 m 12.61 s, peças [original], RT médio 0.19 s, prêmio 60000 CR
- 8. A Volta da Evo — Bianca "Evo": Mitsubishi Lancer Evolution X 2012 (preparado), 391 cv, 476 N·m, 1666 kg, 0–100 3.94 s, 402 m 12.19 s, peças [ecu-programmable, turbo-hybrid, pistons-forged-modern, intercooler-race, boost-control, dct-upgrade, awd-center-tune, tires-slick, suspension-drag-awd], RT médio 0.17 s, prêmio 75000 CR — original: 295 cv, 366 N·m
- 9. O Trevo Vermelho — Dante "Quadrifólio": Alfa Romeo Giulia Quadrifoglio 2017, 512 cv, 601 N·m, 1655 kg, 0–100 4.09 s, 402 m 11.85 s, peças [original], RT médio 0.16 s, prêmio 95000 CR
- 10. Elite da Madrugada — Akira "Godzilla": Nissan GT-R R35 Premium 2015, 553 cv, 628 N·m, 1822 kg, 0–100 3.50 s, 402 m 11.51 s, peças [original], RT médio 0.15 s, prêmio 150000 CR

## Corridas contra os rivais (total = RT + ET, s; V = jogador vence)

Sementes: jogador 1000 + i, rival 2000 + i, corrida 3000 + i. Pista e distância do evento.

| carro | build | piloto | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mitsubishi-evo-x-2012 | Evo X preparado (cap. 2) | intermediate | V 8.64/9.94 | V 8.57/9.78 | V 13.02/14.54 | V 13.10/14.00 | V 12.97/13.24 | · 12.98/12.93 | · 12.96/12.76 | · 12.95/12.66 | · 13.06/12.15 | · 12.95/11.98 |
| mitsubishi-evo-x-2012 | Evo X preparado (cap. 2) | advanced | V 8.54/9.96 | V 8.51/9.87 | V 12.86/14.51 | V 12.92/13.97 | V 12.89/13.23 | V 12.89/12.89 | · 12.86/12.73 | · 12.87/12.70 | · 12.89/12.15 | · 12.87/11.99 |
| bmw-335i-f30-2013 | 335i do Victor (prêmio do cap. 2) | intermediate | V 8.84/9.97 | V 8.76/9.72 | V 13.20/14.58 | V 13.10/13.99 | V 13.03/13.25 | · 13.14/12.88 | · 13.21/12.77 | · 13.11/12.62 | · 13.21/12.13 | · 12.75/11.98 |
| bmw-335i-f30-2013 | 335i do Victor (prêmio do cap. 2) | advanced | V 8.71/10.02 | V 8.71/9.90 | V 13.08/14.51 | V 13.09/14.03 | V 13.07/13.29 | · 13.04/12.87 | · 13.05/12.71 | · 13.07/12.65 | · 13.07/12.15 | · 13.07/11.97 |
| vw-saveiro-gl-1994 | Saveiro do Marcos (prêmio do cap. 1) | intermediate | · 11.01/9.98 | · 11.15/9.88 | · 16.71/14.54 | · 16.58/13.98 | · 16.54/13.25 | · 16.57/12.92 | · 16.66/12.76 | · 16.57/12.64 | · 16.47/12.15 | · 16.61/12.00 |
| vw-saveiro-gl-1994 | Saveiro do Marcos (prêmio do cap. 1) | advanced | · 10.87/9.97 | · 10.84/9.81 | · 16.27/14.54 | · 16.22/14.01 | · 16.25/13.26 | · 16.27/12.90 | · 16.32/12.74 | · 16.23/12.66 | · 16.26/12.14 | · 16.26/11.99 |
| nissan-350z-2006 | original | intermediate | · 10.07/9.99 | · 10.07/9.82 | · 14.81/14.50 | · 14.85/14.02 | · 14.81/13.23 | · 14.70/12.89 | · 14.87/12.79 | · 14.81/12.66 | · 14.72/12.18 | · 14.70/11.96 |
| nissan-350z-2006 | original | advanced | V 9.71/9.94 | V 9.70/9.82 | V 14.45/14.54 | · 14.46/14.02 | · 14.42/13.23 | · 14.43/12.89 | · 14.48/12.78 | · 14.44/12.66 | · 14.47/12.14 | · 14.42/11.98 |
| nissan-350z-2006 | pneus + embreagem | intermediate | V 9.79/9.99 | · 9.83/9.79 | · 14.69/14.52 | · 14.40/13.99 | · 14.42/13.28 | · 14.54/12.92 | · 14.47/12.74 | · 14.13/12.64 | · 14.46/12.14 | · 14.65/11.97 |
| nissan-350z-2006 | pneus + embreagem | advanced | V 9.56/9.93 | V 9.59/9.82 | V 14.30/14.50 | · 14.26/13.99 | · 14.32/13.26 | · 14.30/12.88 | · 14.30/12.79 | · 14.24/12.61 | · 14.26/12.15 | · 14.26/12.01 |
| nissan-350z-2006 | preparado | intermediate | V 9.70/9.98 | V 9.75/9.82 | V 14.43/14.49 | · 14.34/14.00 | · 14.32/13.27 | · 14.32/12.91 | · 14.26/12.77 | · 14.41/12.65 | · 14.32/12.19 | · 14.21/11.99 |
| nissan-350z-2006 | preparado | advanced | V 9.41/9.99 | V 9.36/9.80 | V 13.95/14.57 | V 13.93/13.99 | · 13.93/13.26 | · 13.91/12.92 | · 13.96/12.77 | · 13.96/12.63 | · 14.01/12.14 | · 13.96/11.98 |
| lexus-is350-2015 | original | intermediate | · 10.15/9.95 | · 10.02/9.83 | · 14.75/14.52 | · 14.80/14.03 | · 14.75/13.31 | · 14.70/12.89 | · 14.82/12.73 | · 14.87/12.66 | · 14.87/12.15 | · 14.79/12.02 |
| lexus-is350-2015 | original | advanced | V 9.77/9.96 | V 9.75/9.86 | V 14.50/14.54 | · 14.40/14.03 | · 14.43/13.23 | · 14.43/12.88 | · 14.42/12.77 | · 14.44/12.70 | · 14.46/12.12 | · 14.47/11.98 |
| lexus-is350-2015 | pneus | intermediate | · 10.40/9.93 | · 10.34/9.81 | · 15.17/14.48 | · 15.02/14.01 | · 15.07/13.24 | · 15.12/12.90 | · 15.19/12.73 | · 15.10/12.67 | · 15.21/12.10 | · 15.15/11.97 |
| lexus-is350-2015 | pneus | advanced | V 9.43/9.93 | V 9.42/9.78 | V 14.14/14.59 | · 14.13/14.00 | · 14.12/13.26 | · 14.16/12.89 | · 14.08/12.76 | · 14.05/12.64 | · 14.12/12.16 | · 14.09/11.95 |
| lexus-is350-2015 | preparado | intermediate | · 10.33/9.94 | · 10.24/9.80 | · 14.96/14.53 | · 14.97/14.05 | · 14.80/13.26 | · 14.99/12.90 | · 14.96/12.72 | · 14.89/12.67 | · 14.90/12.13 | · 14.92/12.00 |
| lexus-is350-2015 | preparado | advanced | V 9.30/10.01 | V 9.29/9.82 | V 13.90/14.51 | V 13.88/13.97 | · 13.82/13.28 | · 13.88/12.90 | · 13.84/12.77 | · 13.81/12.68 | · 13.90/12.17 | · 13.89/12.00 |
| nissan-370z-2014 | original | intermediate | V 9.76/9.92 | · 9.86/9.79 | V 14.42/14.54 | · 14.23/13.99 | · 14.21/13.31 | · 14.41/12.93 | · 14.38/12.74 | · 14.44/12.66 | · 14.44/12.11 | · 14.38/11.99 |
| nissan-370z-2014 | original | advanced | V 9.49/9.97 | V 9.48/9.84 | V 14.02/14.53 | V 13.94/13.97 | · 13.97/13.27 | · 14.00/12.91 | · 13.99/12.74 | · 13.99/12.63 | · 13.99/12.17 | · 13.97/11.99 |
| nissan-370z-2014 | pneus + embreagem | intermediate | V 9.65/9.97 | V 9.62/9.79 | V 14.14/14.55 | · 14.15/13.99 | · 14.23/13.28 | · 14.16/12.87 | · 14.13/12.73 | · 14.10/12.64 | · 14.23/12.11 | · 14.11/11.97 |
| nissan-370z-2014 | pneus + embreagem | advanced | V 9.25/9.97 | V 9.30/9.83 | V 13.75/14.49 | V 13.74/14.03 | · 13.73/13.24 | · 13.78/12.89 | · 13.76/12.74 | · 13.78/12.64 | · 13.76/12.11 | · 13.77/11.97 |
| nissan-370z-2014 | preparado | intermediate | V 9.39/9.95 | V 9.38/9.87 | V 14.01/14.54 | V 14.01/14.05 | · 13.90/13.22 | · 13.91/12.94 | · 13.84/12.76 | · 13.88/12.67 | · 13.89/12.12 | · 13.52/11.97 |
| nissan-370z-2014 | preparado | advanced | V 9.07/9.98 | V 9.08/9.82 | V 13.51/14.52 | V 13.52/13.94 | · 13.54/13.24 | · 13.56/12.88 | · 13.46/12.73 | · 13.51/12.68 | · 13.49/12.11 | · 13.52/11.97 |
| mercedes-amg-c43-2017 | original | intermediate | V 8.41/9.95 | V 8.40/9.81 | V 12.44/14.50 | V 12.82/13.97 | V 12.81/13.25 | V 12.87/12.94 | · 12.98/12.76 | · 12.76/12.68 | · 12.76/12.14 | · 12.85/11.97 |
| mercedes-amg-c43-2017 | original | advanced | V 8.24/10.01 | V 8.27/9.77 | V 12.71/14.49 | V 12.71/14.02 | V 12.75/13.28 | V 12.69/12.89 | · 12.75/12.71 | · 12.70/12.65 | · 12.70/12.16 | · 12.74/11.98 |
| mercedes-amg-c43-2017 | Stage 1 | intermediate | V 8.11/10.00 | V 8.03/9.78 | V 12.34/14.53 | V 12.29/14.00 | V 12.37/13.27 | V 11.95/12.89 | V 12.32/12.74 | V 12.37/12.64 | · 12.30/12.13 | · 12.43/11.97 |
| mercedes-amg-c43-2017 | Stage 1 | advanced | V 8.04/10.01 | V 8.07/9.83 | V 12.28/14.48 | V 12.22/13.98 | V 12.24/13.26 | V 12.22/12.90 | V 12.26/12.75 | V 12.28/12.67 | · 12.27/12.18 | · 12.30/11.98 |
| mercedes-amg-c43-2017 | Stage 2 preparado | intermediate | V 7.76/9.98 | V 7.76/9.83 | V 11.86/14.58 | V 11.80/13.99 | V 11.79/13.25 | V 11.92/12.93 | V 11.88/12.72 | V 11.79/12.64 | V 11.80/12.11 | V 11.83/12.00 |
| mercedes-amg-c43-2017 | Stage 2 preparado | advanced | V 7.62/9.96 | V 7.69/9.81 | V 11.72/14.49 | V 11.70/14.01 | V 11.74/13.24 | V 11.67/12.87 | V 11.69/12.74 | V 11.75/12.64 | V 11.70/12.17 | V 11.69/11.98 |
| kia-stinger-gt-2019 | original | intermediate | V 8.73/9.93 | V 8.66/9.75 | V 13.28/14.56 | V 13.24/14.00 | · 13.29/13.23 | · 13.28/12.85 | · 13.21/12.76 | · 13.29/12.65 | · 13.16/12.13 | · 13.27/11.98 |
| kia-stinger-gt-2019 | original | advanced | V 8.63/9.99 | V 8.67/9.81 | V 13.26/14.54 | V 13.25/13.99 | V 13.19/13.23 | · 13.24/12.92 | · 13.22/12.74 | · 13.19/12.66 | · 13.18/12.14 | · 13.18/11.98 |
| kia-stinger-gt-2019 | Stage 1 | intermediate | V 8.39/9.93 | V 8.25/9.79 | V 12.69/14.56 | V 12.63/13.99 | V 12.72/13.30 | V 12.74/12.90 | V 12.71/12.72 | V 12.63/12.68 | · 12.70/12.12 | · 12.72/12.00 |
| kia-stinger-gt-2019 | Stage 1 | advanced | V 8.38/9.96 | V 8.32/9.78 | V 12.64/14.54 | V 12.63/14.00 | V 12.69/13.27 | V 12.60/12.89 | V 12.64/12.74 | V 12.61/12.69 | · 12.71/12.16 | · 12.65/11.99 |
| kia-stinger-gt-2019 | Stage 2 preparado | intermediate | V 7.94/9.95 | V 7.83/9.81 | V 12.10/14.50 | V 12.09/13.99 | V 12.16/13.28 | V 12.02/12.92 | V 12.10/12.74 | V 12.08/12.67 | V 12.12/12.16 | · 12.13/11.98 |
| kia-stinger-gt-2019 | Stage 2 preparado | advanced | V 7.83/9.98 | V 7.88/9.86 | V 12.00/14.49 | V 12.04/14.00 | V 11.98/13.23 | V 12.04/12.89 | V 11.98/12.73 | V 12.06/12.65 | V 12.00/12.14 | V 11.95/11.98 |
| maserati-ghibli-sq4-2015 | original | intermediate | V 8.49/10.01 | V 8.43/9.78 | V 12.93/14.55 | V 12.92/14.01 | V 12.97/13.26 | · 12.96/12.94 | · 12.89/12.76 | V 12.52/12.63 | · 12.85/12.17 | · 12.80/11.99 |
| maserati-ghibli-sq4-2015 | original | advanced | V 8.48/9.98 | V 8.48/9.81 | V 12.90/14.53 | V 12.93/13.95 | V 12.90/13.31 | V 12.85/12.92 | · 12.87/12.71 | · 12.90/12.66 | · 12.84/12.12 | · 12.86/12.00 |
| maserati-ghibli-sq4-2015 | Stage 1 | intermediate | V 8.23/10.01 | V 8.13/9.84 | V 12.36/14.50 | V 12.39/14.02 | V 12.38/13.27 | V 12.39/12.92 | V 12.40/12.74 | V 12.45/12.64 | · 12.40/12.16 | · 12.42/11.98 |
| maserati-ghibli-sq4-2015 | Stage 1 | advanced | V 8.02/9.93 | V 8.08/9.75 | V 12.33/14.52 | V 12.30/13.99 | V 12.31/13.28 | V 12.26/12.87 | V 12.27/12.73 | V 12.24/12.69 | · 12.28/12.16 | · 12.28/11.98 |
| maserati-ghibli-sq4-2015 | Stage 2 preparado | intermediate | V 7.81/9.98 | V 7.80/9.81 | V 11.86/14.53 | V 11.95/14.00 | V 12.01/13.27 | V 11.81/12.87 | V 11.87/12.74 | V 11.93/12.64 | V 11.99/12.16 | V 11.90/12.00 |
| maserati-ghibli-sq4-2015 | Stage 2 preparado | advanced | V 7.77/9.97 | V 7.73/9.78 | V 11.79/14.53 | V 11.79/13.99 | V 11.76/13.26 | V 11.75/12.92 | V 11.74/12.74 | V 11.75/12.67 | V 11.80/12.13 | V 11.73/11.99 |
| alfa-giulia-qv-2017 | original | intermediate | V 8.37/9.96 | V 8.55/9.84 | V 12.59/14.56 | V 12.60/14.00 | V 12.38/13.25 | V 12.45/12.88 | V 12.50/12.73 | V 12.47/12.65 | · 12.62/12.17 | · 12.55/11.97 |
| alfa-giulia-qv-2017 | original | advanced | V 8.31/9.98 | V 8.25/9.78 | V 12.19/14.56 | V 12.12/14.01 | V 12.13/13.27 | V 12.15/12.90 | V 12.15/12.74 | V 12.15/12.62 | · 12.12/12.09 | · 12.18/11.96 |
| alfa-giulia-qv-2017 | Stage 1 | intermediate | V 8.40/9.97 | V 8.45/9.75 | V 12.25/14.55 | V 11.92/13.99 | V 11.92/13.30 | V 11.90/12.90 | V 12.00/12.75 | V 12.23/12.66 | · 12.19/12.15 | · 12.15/11.98 |
| alfa-giulia-qv-2017 | Stage 1 | advanced | V 8.16/9.94 | V 8.07/9.88 | V 11.90/14.57 | V 11.90/14.03 | V 11.88/13.26 | V 11.90/12.90 | V 11.92/12.77 | V 11.98/12.64 | V 11.92/12.13 | V 11.91/11.97 |
| alfa-giulia-qv-2017 | Stage 2 preparado | intermediate | V 7.70/9.98 | V 7.59/9.81 | V 11.15/14.53 | V 11.02/14.03 | V 11.05/13.25 | V 11.00/12.90 | V 11.16/12.74 | V 11.17/12.68 | V 10.91/12.14 | V 11.16/11.96 |
| alfa-giulia-qv-2017 | Stage 2 preparado | advanced | V 7.40/9.94 | V 7.41/9.77 | V 10.90/14.54 | V 10.94/14.00 | V 10.91/13.25 | V 10.93/12.90 | V 10.93/12.70 | V 10.91/12.64 | V 10.97/12.15 | V 10.93/11.99 |
| nissan-gtr-r35-2015 | original | intermediate | V 8.12/9.96 | V 8.21/9.82 | V 12.15/14.51 | V 12.25/14.04 | V 12.16/13.23 | V 12.07/12.89 | V 12.18/12.74 | V 12.23/12.63 | · 12.21/12.10 | · 12.15/11.98 |
| nissan-gtr-r35-2015 | original | advanced | V 8.01/9.96 | V 7.99/9.80 | V 11.99/14.57 | V 12.00/14.02 | V 12.00/13.25 | V 12.01/12.90 | V 11.96/12.75 | V 12.02/12.65 | V 11.95/12.17 | · 12.03/12.01 |
| nissan-gtr-r35-2015 | Stage 1 | intermediate | V 7.81/10.02 | V 7.90/9.81 | V 11.72/14.54 | V 11.72/14.05 | V 11.67/13.26 | V 11.75/12.88 | V 11.72/12.78 | V 11.70/12.65 | V 11.69/12.19 | V 11.71/11.99 |
| nissan-gtr-r35-2015 | Stage 1 | advanced | V 7.74/9.98 | V 7.78/9.87 | V 11.76/14.51 | V 11.72/14.00 | V 11.64/13.25 | V 11.57/12.92 | V 11.59/12.71 | V 11.56/12.67 | V 11.60/12.11 | V 11.54/11.97 |
| nissan-gtr-r35-2015 | Stage 2 preparado | intermediate | V 7.36/9.98 | V 7.27/9.78 | V 11.03/14.54 | V 10.90/14.04 | V 10.86/13.27 | V 10.98/12.93 | V 11.08/12.73 | V 10.94/12.62 | V 10.97/12.17 | V 10.96/11.98 |
| nissan-gtr-r35-2015 | Stage 2 preparado | advanced | V 7.21/9.97 | V 7.27/9.79 | V 10.93/14.58 | V 10.85/14.02 | V 10.90/13.21 | V 10.87/12.90 | V 10.90/12.72 | V 10.84/12.62 | V 10.88/12.16 | V 10.88/11.98 |
