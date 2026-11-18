# Balanceamento — Capítulo 3 (gerado por scripts/balance-chapter3.ts)

## Builds (pista de testes, piloto avançado)

| carro | build | custo (CR) | cv | N·m | massa (kg) | peças | boost máx. | 0–100 | 201 m | 402 m | 1000 m | vel. 402 m | patinagem | trocas | câmbio |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| bmw-335i-f30-2013 | 335i original | 0 | 306 | 400 | 1660 | 0 | — | 5.53 | 9.09 | 13.71 | 24.48 | 278 km/h | 1.45 s | 6 | torque-converter-auto |
| bmw-335i-f30-2013 | 335i Stage 1 | 9700 | 352 | 470 | 1660 | 4 | 1.15 bar | 4.70 | 8.51 | 12.88 | 23.09 | 292 km/h | 0.43 s | 6 | torque-converter-auto |
| bmw-335i-f30-2013 | 335i Stage 2 | 30800 | 392 | 512 | 1618 | 9 | 1.40 bar | 4.09 | 8.02 | 12.22 | 22.03 | 302 km/h | 0.69 s | 6 | torque-converter-auto |
| bmw-335i-f30-2013 | 335i Stage 3 | 43300 | 489 | 629 | 1621 | 10 | 1.65 bar | 3.77 | 7.71 | 11.62 | 20.72 | 331 km/h | 0.86 s | 7 | torque-converter-auto |
| mitsubishi-evo-x-2012 | Evo X preparado (cap. 2) | 17100 | 369 | 442 | 1663 | 7 | 1.63 bar | 4.13 | 8.06 | 12.40 | 22.64 | 271 km/h | 0.00 s | 5 | dual-clutch |
| mitsubishi-evo-x-2012 | Evo X Stage 3 | 44200 | 452 | 537 | 1666 | 10 | 2.05 bar | 3.59 | 7.62 | 11.70 | 21.33 | 278 km/h | 0.02 s | 5 | dual-clutch |
| vw-golf-gti-mk4-2003 | Golf GTI preparado | 30000 | 230 | 301 | 1291 | 11 | 1.35 bar | 5.86 | 9.37 | 14.21 | 25.54 | 241 km/h | 1.01 s | 4 | manual |
| nissan-350z-2006 | original | 0 | 304 | 353 | 1595 | 0 | — | 5.79 | 9.37 | 14.10 | 24.99 | 282 km/h | 0.67 s | 5 | manual |
| nissan-350z-2006 | pneus + embreagem | 2500 | 304 | 353 | 1595 | 2 | — | 5.56 | 9.17 | 13.89 | 24.76 | 282 km/h | 0.69 s | 5 | manual |
| nissan-350z-2006 | preparado | 19600 | 335 | 372 | 1540 | 10 | — | 5.12 | 8.67 | 13.16 | 23.52 | 288 km/h | 0.69 s | 5 | manual |
| lexus-is350-2015 | original | 0 | 312 | 376 | 1705 | 0 | — | 5.93 | 9.38 | 14.07 | 24.96 | 275 km/h | 1.09 s | 9 | torque-converter-auto |
| lexus-is350-2015 | pneus | 1600 | 312 | 376 | 1705 | 1 | — | 5.59 | 9.09 | 13.77 | 24.64 | 275 km/h | 0.69 s | 7 | torque-converter-auto |
| lexus-is350-2015 | preparado | 18800 | 333 | 392 | 1657 | 8 | — | 4.74 | 8.47 | 12.95 | 23.42 | 284 km/h | 0.54 s | 7 | torque-converter-auto |
| nissan-370z-2014 | original | 0 | 337 | 366 | 1562 | 0 | — | 5.34 | 9.07 | 13.63 | 24.12 | 294 km/h | 1.23 s | 5 | manual |
| nissan-370z-2014 | pneus + embreagem | 2500 | 337 | 366 | 1562 | 2 | — | 5.10 | 8.85 | 13.40 | 23.88 | 294 km/h | 0.63 s | 5 | manual |
| nissan-370z-2014 | preparado | 20000 | 367 | 384 | 1507 | 10 | — | 4.81 | 8.46 | 12.81 | 22.85 | 294 km/h | 0.52 s | 5 | manual |
| mercedes-amg-c43-2017 | original | 0 | 367 | 521 | 1780 | 0 | — | 4.33 | 8.19 | 12.61 | 22.90 | 299 km/h | 0.16 s | 7 | torque-converter-auto |
| mercedes-amg-c43-2017 | Stage 1 | 2500 | 417 | 578 | 1780 | 1 | 1.20 bar | 3.92 | 7.89 | 12.12 | 21.99 | 313 km/h | 0.21 s | 7 | torque-converter-auto |
| mercedes-amg-c43-2017 | Stage 2 preparado | 30500 | 468 | 666 | 1778 | 9 | 1.45 bar | 3.56 | 7.57 | 11.62 | 21.06 | 328 km/h | 0.03 s | 7 | torque-converter-auto |
| kia-stinger-gt-2019 | original | 0 | 370 | 510 | 1935 | 0 | — | 4.88 | 8.56 | 13.13 | 23.80 | 286 km/h | 0.01 s | 6 | torque-converter-auto |
| kia-stinger-gt-2019 | Stage 1 | 2500 | 430 | 561 | 1935 | 1 | 1.20 bar | 4.46 | 8.26 | 12.62 | 22.76 | 299 km/h | 0.01 s | 7 | torque-converter-auto |
| kia-stinger-gt-2019 | Stage 2 preparado | 30500 | 474 | 653 | 1933 | 9 | 1.45 bar | 3.76 | 7.74 | 11.90 | 21.60 | 312 km/h | 0.00 s | 7 | torque-converter-auto |
| maserati-ghibli-sq4-2015 | original | 0 | 410 | 551 | 1945 | 0 | — | 4.58 | 8.38 | 12.79 | 23.08 | 294 km/h | 0.00 s | 6 | torque-converter-auto |
| maserati-ghibli-sq4-2015 | Stage 1 | 2500 | 464 | 612 | 1945 | 1 | 1.25 bar | 4.08 | 8.01 | 12.24 | 22.10 | 308 km/h | 0.00 s | 7 | torque-converter-auto |
| maserati-ghibli-sq4-2015 | Stage 2 preparado | 30500 | 522 | 705 | 1943 | 9 | 1.50 bar | 3.55 | 7.57 | 11.60 | 21.01 | 324 km/h | 0.00 s | 7 | torque-converter-auto |
| alfa-giulia-qv-2017 | original | 0 | 512 | 601 | 1655 | 0 | — | 4.09 | 7.93 | 11.85 | 20.97 | 323 km/h | 1.22 s | 7 | torque-converter-auto |
| alfa-giulia-qv-2017 | Stage 1 | 2500 | 576 | 681 | 1655 | 1 | 1.50 bar | 4.04 | 7.83 | 11.61 | 20.37 | 340 km/h | 1.36 s | 7 | torque-converter-auto |
| alfa-giulia-qv-2017 | Stage 2 preparado | 28000 | 655 | 769 | 1661 | 8 | 1.75 bar | 2.96 | 6.94 | 10.50 | 18.83 | 357 km/h | 0.67 s | 7 | torque-converter-auto |
| nissan-gtr-r35-2015 | original | 0 | 553 | 628 | 1822 | 0 | — | 3.50 | 7.52 | 11.51 | 20.72 | 304 km/h | 0.20 s | 5 | dual-clutch |
| nissan-gtr-r35-2015 | Stage 1 | 2500 | 630 | 732 | 1822 | 1 | 1.30 bar | 3.26 | 7.32 | 11.24 | 20.15 | 304 km/h | 0.25 s | 5 | dual-clutch |
| nissan-gtr-r35-2015 | Stage 2 preparado | 31700 | 707 | 804 | 1820 | 9 | 1.55 bar | 2.68 | 6.75 | 10.39 | 18.96 | 313 km/h | 0.13 s | 5 | dual-clutch |

## Rivais

| # | Duelo | Distância | Rival | Carro | cv | N·m | kg | 0–100 | 201 m | 402 m | 1000 m | RT médio | Prêmio (CR) | Original (cv / N·m) |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | A Volta do GTI | eighth | Ricardo "GTI" | Volkswagen Golf GTI 1.8T 2003 (preparado) | 230 | 301 | 1291 | 5.86 | 9.37 | 14.21 | 25.54 | 0.19 s | 15000 | 180 / 235 |
|   | peças | | | ecu-stage2, downpipe-catless, intercooler-race, intake-direct-turbo, pistons-forged-modern, clutch-reinforced, tires-slick, suspension-drag-fwd, weight-medium, flywheel-light-modern, differential-short | | | | | | | | | | |
| 2 | Primeira Elite | eighth | Hugo "Z" | Nissan 350Z Coupé 2006 (preparado) | 323 | 368 | 1547 | 5.26 | 8.78 | 13.33 | 23.85 | 0.22 s | 20000 | 304 / 353 |
|   | peças | | | filter-v6-flow, exhaust-v6-sport, ecu-v6-na, clutch-reinforced, tires-slick, differential-short, weight-medium, suspension-drag-rwd | | | | | | | | | | |
| 3 | Silêncio Refinado | quarter | Renata "Silêncio" | Lexus IS 350 F Sport 2015 (preparado) | 333 | 392 | 1657 | 4.74 | 8.47 | 12.95 | 23.42 | 0.21 s | 26000 | 312 / 376 |
|   | peças | | | filter-v6-flow, exhaust-v6-sport, ecu-v6-na, at-upgrade, tires-slick, differential-short, weight-medium, suspension-drag-rwd | | | | | | | | | | |
| 4 | Zeta de Verdade | quarter | Bruno "Zeta" | Nissan 370Z Coupé 2014 (preparado) | 367 | 384 | 1514 | 4.83 | 8.48 | 12.84 | 22.88 | 0.2 s | 32000 | 337 / 366 |
|   | peças | | | filter-v6-flow, exhaust-v6-sport, ecu-v6-na, cam-vq37-s1, clutch-reinforced, tires-slick, differential-short, weight-medium, suspension-drag-rwd | | | | | | | | | | |
| 5 | Peso Pesado | quarter | Davi "Stinger" | Kia Stinger GT 2019 AWD (preparado) | 439 | 561 | 1927 | 4.15 | 8.04 | 12.32 | 22.32 | 0.18 s | 40000 | 370 / 510 |
|   | peças | | | ecu-stage1, intake-direct-turbo, at-upgrade, tires-semislick, awd-center-tune, suspension-drag-awd | | | | | | | | | | |
| 6 | Salão Italiano | km | Valentina "Salão" | Maserati Ghibli S Q4 2015 (preparado) | 522 | 705 | 1943 | 3.55 | 7.57 | 11.60 | 21.01 | 0.17 s | 48000 | 410 / 551 |
|   | peças | | | ecu-stage2, downpipe-catless, intercooler-race, intake-direct-turbo, pistons-forged-modern, at-upgrade, tires-slick, awd-center-tune, suspension-drag-awd | | | | | | | | | | |
| 7 | Biturbo Alemão | quarter | Maya "Três-Mais" | Mercedes-AMG C 43 4MATIC 2017 (preparado) | 468 | 666 | 1778 | 3.56 | 7.57 | 11.62 | 21.06 | 0.19 s | 60000 | 367 / 521 |
|   | peças | | | ecu-stage2, downpipe-catless, intercooler-race, intake-direct-turbo, pistons-forged-modern, at-upgrade, tires-slick, awd-center-tune, suspension-drag-awd | | | | | | | | | | |
| 8 | A Volta da Evo | km | Bianca "Evo" | Mitsubishi Lancer Evolution X 2012 (preparado) | 452 | 537 | 1666 | 3.59 | 7.62 | 11.70 | 21.33 | 0.17 s | 75000 | 295 / 366 |
|   | peças | | | ecu-stage3, turbo-hybrid, downpipe-catless, intake-direct-turbo, pistons-forged-modern, intercooler-race, dct-upgrade, awd-center-tune, tires-slick, suspension-drag-awd | | | | | | | | | | |
| 9 | O Trevo Vermelho | quarter | Dante "Quadrifólio" | Alfa Romeo Giulia Quadrifoglio 2017 (preparado) | 655 | 769 | 1661 | 2.96 | 6.94 | 10.50 | 18.83 | 0.16 s | 95000 | 512 / 601 |
|   | peças | | | ecu-stage2, downpipe-catless, intercooler-race, intake-direct-turbo, pistons-forged-modern, at-upgrade, tires-slick, suspension-drag-rwd | | | | | | | | | | |
| 10 | Elite da Madrugada | km | Akira "Godzilla" | Nissan GT-R R35 Premium 2015 (preparado) | 707 | 804 | 1820 | 2.68 | 6.75 | 10.39 | 18.96 | 0.15 s | 150000 | 553 / 628 |
|   | peças | | | ecu-stage2, downpipe-catless, intercooler-race, intake-direct-turbo, pistons-forged-modern, dct-upgrade, tires-slick, awd-center-tune, suspension-drag-awd | | | | | | | | | | |

## Corridas contra os rivais (3 sementes por duelo; célula = vitórias do jogador / 3)

Sementes: jogador 1000 + i, rival 2000 + i, corrida 3000 + i. Pista e distância do evento; o piloto humano tem reação 0,22 s, trocas ±90 rpm e controle de tração mais frouxo.

| carro | build | piloto | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | vitórias |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bmw-335i-f30-2013 | 335i original | intermediário | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| bmw-335i-f30-2013 | 335i original | avançado | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| bmw-335i-f30-2013 | 335i original | humano | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| bmw-335i-f30-2013 | 335i Stage 1 | intermediário | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| bmw-335i-f30-2013 | 335i Stage 1 | avançado | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| bmw-335i-f30-2013 | 335i Stage 1 | humano | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| bmw-335i-f30-2013 | 335i Stage 2 | intermediário | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| bmw-335i-f30-2013 | 335i Stage 2 | avançado | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| bmw-335i-f30-2013 | 335i Stage 2 | humano | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| bmw-335i-f30-2013 | 335i Stage 3 | intermediário | 3 | 3 | 3 | 3 | 3 | 3 | 0 | 3 | 0 | 0 | 21 |
| bmw-335i-f30-2013 | 335i Stage 3 | avançado | 3 | 3 | 3 | 3 | 3 | 3 | 0 | 3 | 0 | 0 | 21 |
| bmw-335i-f30-2013 | 335i Stage 3 | humano | 3 | 3 | 3 | 3 | 3 | 3 | 0 | 3 | 0 | 0 | 21 |
| mitsubishi-evo-x-2012 | Evo X preparado (cap. 2) | intermediário | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| mitsubishi-evo-x-2012 | Evo X preparado (cap. 2) | avançado | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| mitsubishi-evo-x-2012 | Evo X preparado (cap. 2) | humano | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| mitsubishi-evo-x-2012 | Evo X Stage 3 | intermediário | 3 | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 15 |
| mitsubishi-evo-x-2012 | Evo X Stage 3 | avançado | 3 | 3 | 3 | 3 | 3 | 0 | 0 | 3 | 0 | 0 | 18 |
| mitsubishi-evo-x-2012 | Evo X Stage 3 | humano | 3 | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 15 |
| vw-golf-gti-mk4-2003 | Golf GTI preparado | intermediário | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| vw-golf-gti-mk4-2003 | Golf GTI preparado | avançado | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| vw-golf-gti-mk4-2003 | Golf GTI preparado | humano | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| vw-saveiro-gl-1994 | Saveiro do Marcos (prêmio do cap. 1) | intermediário | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| vw-saveiro-gl-1994 | Saveiro do Marcos (prêmio do cap. 1) | avançado | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| vw-saveiro-gl-1994 | Saveiro do Marcos (prêmio do cap. 1) | humano | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| nissan-350z-2006 | original | intermediário | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| nissan-350z-2006 | original | avançado | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| nissan-350z-2006 | original | humano | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| nissan-350z-2006 | preparado | intermediário | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| nissan-350z-2006 | preparado | avançado | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 9 |
| nissan-350z-2006 | preparado | humano | 3 | 3 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8 |
| lexus-is350-2015 | original | intermediário | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lexus-is350-2015 | original | avançado | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| lexus-is350-2015 | original | humano | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| lexus-is350-2015 | preparado | intermediário | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| lexus-is350-2015 | preparado | avançado | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 9 |
| lexus-is350-2015 | preparado | humano | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6 |
| nissan-370z-2014 | original | intermediário | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| nissan-370z-2014 | original | avançado | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| nissan-370z-2014 | original | humano | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| nissan-370z-2014 | preparado | intermediário | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 9 |
| nissan-370z-2014 | preparado | avançado | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| nissan-370z-2014 | preparado | humano | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 9 |
| mercedes-amg-c43-2017 | original | intermediário | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| mercedes-amg-c43-2017 | original | avançado | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| mercedes-amg-c43-2017 | original | humano | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| mercedes-amg-c43-2017 | Stage 2 preparado | intermediário | 3 | 3 | 3 | 3 | 3 | 2 | 1 | 3 | 0 | 0 | 21 |
| mercedes-amg-c43-2017 | Stage 2 preparado | avançado | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 0 | 0 | 23 |
| mercedes-amg-c43-2017 | Stage 2 preparado | humano | 3 | 3 | 3 | 3 | 3 | 2 | 2 | 3 | 0 | 0 | 22 |
| kia-stinger-gt-2019 | original | intermediário | 3 | 3 | 3 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 11 |
| kia-stinger-gt-2019 | original | avançado | 3 | 3 | 3 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 11 |
| kia-stinger-gt-2019 | original | humano | 3 | 3 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 10 |
| kia-stinger-gt-2019 | Stage 2 preparado | intermediário | 3 | 3 | 3 | 3 | 3 | 0 | 0 | 2 | 0 | 0 | 17 |
| kia-stinger-gt-2019 | Stage 2 preparado | avançado | 3 | 3 | 3 | 3 | 3 | 0 | 0 | 3 | 0 | 0 | 18 |
| kia-stinger-gt-2019 | Stage 2 preparado | humano | 3 | 3 | 3 | 3 | 3 | 0 | 0 | 2 | 0 | 0 | 17 |
| maserati-ghibli-sq4-2015 | original | intermediário | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| maserati-ghibli-sq4-2015 | original | avançado | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| maserati-ghibli-sq4-2015 | original | humano | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| maserati-ghibli-sq4-2015 | Stage 2 preparado | intermediário | 3 | 3 | 3 | 3 | 3 | 0 | 0 | 3 | 0 | 0 | 18 |
| maserati-ghibli-sq4-2015 | Stage 2 preparado | avançado | 3 | 3 | 3 | 3 | 3 | 3 | 0 | 3 | 0 | 0 | 21 |
| maserati-ghibli-sq4-2015 | Stage 2 preparado | humano | 3 | 3 | 3 | 3 | 3 | 2 | 0 | 3 | 0 | 0 | 20 |
| alfa-giulia-qv-2017 | original | intermediário | 3 | 3 | 3 | 3 | 2 | 0 | 0 | 3 | 0 | 0 | 17 |
| alfa-giulia-qv-2017 | original | avançado | 3 | 3 | 3 | 3 | 3 | 0 | 0 | 3 | 0 | 0 | 18 |
| alfa-giulia-qv-2017 | original | humano | 3 | 3 | 3 | 3 | 3 | 0 | 0 | 3 | 0 | 0 | 18 |
| alfa-giulia-qv-2017 | Stage 2 preparado | intermediário | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 0 | 0 | 24 |
| alfa-giulia-qv-2017 | Stage 2 preparado | avançado | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 1 | 0 | 25 |
| alfa-giulia-qv-2017 | Stage 2 preparado | humano | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 0 | 0 | 24 |
| nissan-gtr-r35-2015 | original | intermediário | 3 | 3 | 3 | 3 | 3 | 0 | 0 | 3 | 0 | 0 | 18 |
| nissan-gtr-r35-2015 | original | avançado | 3 | 3 | 3 | 3 | 3 | 3 | 0 | 3 | 0 | 0 | 21 |
| nissan-gtr-r35-2015 | original | humano | 3 | 3 | 3 | 3 | 3 | 1 | 0 | 3 | 0 | 0 | 19 |
| nissan-gtr-r35-2015 | Stage 2 preparado | intermediário | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 0 | 0 | 24 |
| nissan-gtr-r35-2015 | Stage 2 preparado | avançado | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 1 | 28 |
| nissan-gtr-r35-2015 | Stage 2 preparado | humano | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 0 | 27 |

### Detalhe do piloto humano (médias das sementes)

| carro | duelo | vitórias | RT | 201 m | 402 m | 1000 m | vel. final (km/h) | DNF |
|---|---|---|---:|---:|---:|---:|---:|---:|
| 335i original | 1 | 3/3 | 0.62 | 8.91 | 0.00 | — | 136 | 0 |
| 335i original | 2 | 0/3 | 0.62 | 8.91 | 0.00 | — | 136 | 0 |
| 335i original | 3 | 0/3 | 0.62 | 8.91 | 13.55 | — | 171 | 0 |
| 335i original | 4 | 0/3 | 0.62 | 8.87 | 13.51 | — | 171 | 0 |
| 335i original | 5 | 0/3 | 0.62 | 8.87 | 13.51 | — | 171 | 0 |
| 335i original | 6 | 0/3 | 0.62 | 8.87 | 13.51 | 24.31 | 220 | 0 |
| 335i original | 7 | 0/3 | 0.62 | 8.87 | 13.51 | — | 171 | 0 |
| 335i original | 8 | 0/3 | 0.62 | 8.90 | 13.53 | 24.28 | 222 | 0 |
| 335i original | 9 | 0/3 | 0.62 | 8.90 | 13.53 | — | 172 | 0 |
| 335i original | 10 | 0/3 | 0.62 | 8.90 | 13.53 | 24.28 | 222 | 0 |
| 335i Stage 1 | 1 | 3/3 | 0.60 | 8.14 | 0.00 | — | 143 | 0 |
| 335i Stage 1 | 2 | 3/3 | 0.60 | 8.14 | 0.00 | — | 143 | 0 |
| 335i Stage 1 | 3 | 3/3 | 0.60 | 8.14 | 12.53 | — | 181 | 0 |
| 335i Stage 1 | 4 | 3/3 | 0.60 | 8.08 | 12.47 | — | 181 | 0 |
| 335i Stage 1 | 5 | 0/3 | 0.60 | 8.08 | 12.47 | — | 181 | 0 |
| 335i Stage 1 | 6 | 0/3 | 0.60 | 8.08 | 12.47 | 22.71 | 232 | 0 |
| 335i Stage 1 | 7 | 0/3 | 0.60 | 8.08 | 12.47 | — | 181 | 0 |
| 335i Stage 1 | 8 | 0/3 | 0.60 | 8.11 | 12.49 | 22.69 | 234 | 0 |
| 335i Stage 1 | 9 | 0/3 | 0.60 | 8.11 | 12.49 | — | 181 | 0 |
| 335i Stage 1 | 10 | 0/3 | 0.60 | 8.11 | 12.49 | 22.69 | 234 | 0 |
| 335i Stage 2 | 1 | 3/3 | 0.60 | 7.99 | 0.00 | — | 149 | 0 |
| 335i Stage 2 | 2 | 3/3 | 0.60 | 7.99 | 0.00 | — | 149 | 0 |
| 335i Stage 2 | 3 | 3/3 | 0.60 | 7.99 | 12.21 | — | 188 | 0 |
| 335i Stage 2 | 4 | 3/3 | 0.60 | 7.94 | 12.16 | — | 188 | 0 |
| 335i Stage 2 | 5 | 0/3 | 0.60 | 7.94 | 12.16 | — | 188 | 0 |
| 335i Stage 2 | 6 | 0/3 | 0.60 | 7.94 | 12.16 | 22.01 | 241 | 0 |
| 335i Stage 2 | 7 | 0/3 | 0.60 | 7.94 | 12.16 | — | 188 | 0 |
| 335i Stage 2 | 8 | 0/3 | 0.60 | 7.97 | 12.18 | 21.99 | 243 | 0 |
| 335i Stage 2 | 9 | 0/3 | 0.60 | 7.97 | 12.18 | — | 188 | 0 |
| 335i Stage 2 | 10 | 0/3 | 0.60 | 7.97 | 12.18 | 21.99 | 243 | 0 |
| 335i Stage 3 | 1 | 3/3 | 0.59 | 7.52 | 0.00 | — | 160 | 0 |
| 335i Stage 3 | 2 | 3/3 | 0.59 | 7.53 | 0.00 | — | 160 | 0 |
| 335i Stage 3 | 3 | 3/3 | 0.59 | 7.53 | 11.45 | — | 202 | 0 |
| 335i Stage 3 | 4 | 3/3 | 0.59 | 7.45 | 11.38 | — | 202 | 0 |
| 335i Stage 3 | 5 | 3/3 | 0.59 | 7.45 | 11.38 | — | 202 | 0 |
| 335i Stage 3 | 6 | 3/3 | 0.59 | 7.45 | 11.38 | 20.52 | 260 | 0 |
| 335i Stage 3 | 7 | 0/3 | 0.59 | 7.45 | 11.37 | — | 202 | 0 |
| 335i Stage 3 | 8 | 3/3 | 0.59 | 7.49 | 11.41 | 20.51 | 261 | 0 |
| 335i Stage 3 | 9 | 0/3 | 0.59 | 7.49 | 11.41 | — | 202 | 0 |
| 335i Stage 3 | 10 | 0/3 | 0.59 | 7.49 | 11.41 | 20.51 | 261 | 0 |
| Evo X preparado (cap. 2) | 1 | 3/3 | 0.82 | 7.75 | 0.00 | — | 146 | 0 |
| Evo X preparado (cap. 2) | 2 | 3/3 | 0.82 | 7.75 | 0.00 | — | 146 | 0 |
| Evo X preparado (cap. 2) | 3 | 3/3 | 0.82 | 7.75 | 12.10 | — | 182 | 0 |
| Evo X preparado (cap. 2) | 4 | 3/3 | 0.82 | 7.75 | 12.11 | — | 181 | 0 |
| Evo X preparado (cap. 2) | 5 | 0/3 | 0.82 | 7.75 | 12.11 | — | 181 | 0 |
| Evo X preparado (cap. 2) | 6 | 0/3 | 0.82 | 7.75 | 12.11 | 22.38 | 230 | 0 |
| Evo X preparado (cap. 2) | 7 | 0/3 | 0.82 | 7.75 | 12.11 | — | 181 | 0 |
| Evo X preparado (cap. 2) | 8 | 0/3 | 0.82 | 7.75 | 12.09 | 22.31 | 232 | 0 |
| Evo X preparado (cap. 2) | 9 | 0/3 | 0.82 | 7.75 | 12.09 | — | 182 | 0 |
| Evo X preparado (cap. 2) | 10 | 0/3 | 0.82 | 7.75 | 12.09 | 22.31 | 232 | 0 |
| Evo X Stage 3 | 1 | 3/3 | 0.80 | 7.34 | 0.00 | — | 154 | 0 |
| Evo X Stage 3 | 2 | 3/3 | 0.80 | 7.34 | 0.00 | — | 154 | 0 |
| Evo X Stage 3 | 3 | 3/3 | 0.80 | 7.34 | 11.45 | — | 193 | 0 |
| Evo X Stage 3 | 4 | 3/3 | 0.80 | 7.34 | 11.45 | — | 193 | 0 |
| Evo X Stage 3 | 5 | 3/3 | 0.80 | 7.34 | 11.45 | — | 193 | 0 |
| Evo X Stage 3 | 6 | 0/3 | 0.80 | 7.34 | 11.45 | 21.13 | 245 | 0 |
| Evo X Stage 3 | 7 | 0/3 | 0.80 | 7.34 | 11.45 | — | 193 | 0 |
| Evo X Stage 3 | 8 | 0/3 | 0.80 | 7.34 | 11.44 | 21.06 | 247 | 0 |
| Evo X Stage 3 | 9 | 0/3 | 0.80 | 7.34 | 11.44 | — | 193 | 0 |
| Evo X Stage 3 | 10 | 0/3 | 0.80 | 7.34 | 11.44 | 21.06 | 247 | 0 |
| Golf GTI preparado | 1 | 1/3 | 0.79 | 9.22 | 0.00 | — | 130 | 0 |
| Golf GTI preparado | 2 | 0/3 | 0.79 | 9.22 | 0.00 | — | 130 | 0 |
| Golf GTI preparado | 3 | 0/3 | 0.79 | 9.22 | 14.09 | — | 164 | 0 |
| Golf GTI preparado | 4 | 0/3 | 0.78 | 9.18 | 14.05 | — | 163 | 0 |
| Golf GTI preparado | 5 | 0/3 | 0.78 | 9.18 | 14.05 | — | 163 | 0 |
| Golf GTI preparado | 6 | 0/3 | 0.78 | 9.18 | 14.05 | 25.45 | 208 | 0 |
| Golf GTI preparado | 7 | 0/3 | 0.78 | 9.18 | 14.05 | — | 163 | 0 |
| Golf GTI preparado | 8 | 0/3 | 0.79 | 9.19 | 14.05 | 25.38 | 210 | 0 |
| Golf GTI preparado | 9 | 0/3 | 0.79 | 9.19 | 14.05 | — | 164 | 0 |
| Golf GTI preparado | 10 | 0/3 | 0.79 | 9.19 | 14.05 | 25.38 | 210 | 0 |
| Saveiro do Marcos (prêmio do cap. 1) | 1 | 0/3 | 0.84 | 10.10 | 0.00 | — | 117 | 0 |
| Saveiro do Marcos (prêmio do cap. 1) | 2 | 0/3 | 0.84 | 10.10 | 0.00 | — | 117 | 0 |
| Saveiro do Marcos (prêmio do cap. 1) | 3 | 0/3 | 0.84 | 10.10 | 15.57 | — | 144 | 0 |
| Saveiro do Marcos (prêmio do cap. 1) | 4 | 0/3 | 0.84 | 10.07 | 15.56 | — | 143 | 0 |
| Saveiro do Marcos (prêmio do cap. 1) | 5 | 0/3 | 0.84 | 10.07 | 15.56 | — | 143 | 0 |
| Saveiro do Marcos (prêmio do cap. 1) | 6 | 0/3 | 0.84 | 10.07 | 15.56 | 28.95 | 172 | 0 |
| Saveiro do Marcos (prêmio do cap. 1) | 7 | 0/3 | 0.84 | 10.07 | 15.56 | — | 143 | 0 |
| Saveiro do Marcos (prêmio do cap. 1) | 8 | 0/3 | 0.84 | 10.08 | 15.53 | 28.76 | 175 | 0 |
| Saveiro do Marcos (prêmio do cap. 1) | 9 | 0/3 | 0.84 | 10.08 | 15.53 | — | 145 | 0 |
| Saveiro do Marcos (prêmio do cap. 1) | 10 | 0/3 | 0.84 | 10.08 | 15.53 | 28.76 | 175 | 0 |
| original | 1 | 3/3 | 0.69 | 9.13 | 0.00 | — | 132 | 0 |
| original | 2 | 0/3 | 0.69 | 9.13 | 0.00 | — | 132 | 0 |
| original | 3 | 0/3 | 0.69 | 9.13 | 13.89 | — | 168 | 0 |
| original | 4 | 0/3 | 0.68 | 9.10 | 13.86 | — | 168 | 0 |
| original | 5 | 0/3 | 0.68 | 9.10 | 13.86 | — | 168 | 0 |
| original | 6 | 0/3 | 0.68 | 9.10 | 13.86 | 24.80 | 219 | 0 |
| original | 7 | 0/3 | 0.68 | 9.10 | 13.86 | — | 168 | 0 |
| original | 8 | 0/3 | 0.69 | 9.12 | 13.87 | 24.76 | 221 | 0 |
| original | 9 | 0/3 | 0.69 | 9.12 | 13.87 | — | 168 | 0 |
| original | 10 | 0/3 | 0.69 | 9.12 | 13.87 | 24.76 | 221 | 0 |
| preparado | 1 | 3/3 | 0.64 | 8.52 | 0.00 | — | 138 | 0 |
| preparado | 2 | 3/3 | 0.64 | 8.52 | 0.00 | — | 138 | 0 |
| preparado | 3 | 2/3 | 0.64 | 8.52 | 13.02 | — | 176 | 0 |
| preparado | 4 | 0/3 | 0.64 | 8.51 | 13.01 | — | 176 | 0 |
| preparado | 5 | 0/3 | 0.64 | 8.51 | 13.01 | — | 176 | 0 |
| preparado | 6 | 0/3 | 0.64 | 8.51 | 13.01 | 23.42 | 228 | 0 |
| preparado | 7 | 0/3 | 0.64 | 8.51 | 13.01 | — | 176 | 0 |
| preparado | 8 | 0/3 | 0.64 | 8.50 | 13.00 | 23.36 | 230 | 0 |
| preparado | 9 | 0/3 | 0.64 | 8.50 | 13.00 | — | 176 | 0 |
| preparado | 10 | 0/3 | 0.64 | 8.50 | 13.00 | 23.36 | 230 | 0 |
| original | 1 | 3/3 | 0.61 | 9.24 | 0.00 | — | 134 | 0 |
| original | 2 | 0/3 | 0.61 | 9.24 | 0.00 | — | 134 | 0 |
| original | 3 | 0/3 | 0.61 | 9.24 | 13.95 | — | 169 | 0 |
| original | 4 | 0/3 | 0.61 | 9.19 | 13.90 | — | 169 | 0 |
| original | 5 | 0/3 | 0.61 | 9.19 | 13.90 | — | 169 | 0 |
| original | 6 | 0/3 | 0.61 | 9.19 | 13.90 | 24.83 | 219 | 0 |
| original | 7 | 0/3 | 0.61 | 9.19 | 13.90 | — | 169 | 0 |
| original | 8 | 0/3 | 0.61 | 9.23 | 13.93 | 24.81 | 220 | 0 |
| original | 9 | 0/3 | 0.61 | 9.23 | 13.93 | — | 169 | 0 |
| original | 10 | 0/3 | 0.61 | 9.23 | 13.93 | 24.81 | 220 | 0 |
| preparado | 1 | 3/3 | 0.58 | 8.64 | 0.00 | — | 140 | 0 |
| preparado | 2 | 3/3 | 0.58 | 8.64 | 0.00 | — | 140 | 0 |
| preparado | 3 | 0/3 | 0.58 | 8.64 | 13.15 | — | 176 | 0 |
| preparado | 4 | 0/3 | 0.57 | 8.53 | 13.04 | — | 176 | 0 |
| preparado | 5 | 0/3 | 0.57 | 8.53 | 13.04 | — | 176 | 0 |
| preparado | 6 | 0/3 | 0.57 | 8.53 | 13.04 | 23.56 | 227 | 0 |
| preparado | 7 | 0/3 | 0.57 | 8.53 | 13.04 | — | 176 | 0 |
| preparado | 8 | 0/3 | 0.57 | 8.61 | 13.11 | 23.59 | 228 | 0 |
| preparado | 9 | 0/3 | 0.57 | 8.61 | 13.11 | — | 177 | 0 |
| preparado | 10 | 0/3 | 0.57 | 8.61 | 13.11 | 23.59 | 228 | 0 |
| original | 1 | 3/3 | 0.69 | 8.86 | 0.00 | — | 137 | 0 |
| original | 2 | 0/3 | 0.69 | 8.86 | 0.00 | — | 137 | 0 |
| original | 3 | 0/3 | 0.69 | 8.86 | 13.46 | — | 174 | 0 |
| original | 4 | 0/3 | 0.68 | 8.81 | 13.40 | — | 174 | 0 |
| original | 5 | 0/3 | 0.68 | 8.81 | 13.40 | — | 174 | 0 |
| original | 6 | 0/3 | 0.68 | 8.81 | 13.40 | 23.95 | 228 | 0 |
| original | 7 | 0/3 | 0.68 | 8.81 | 13.40 | — | 174 | 0 |
| original | 8 | 0/3 | 0.69 | 8.85 | 13.44 | 23.93 | 229 | 0 |
| original | 9 | 0/3 | 0.69 | 8.85 | 13.44 | — | 175 | 0 |
| original | 10 | 0/3 | 0.69 | 8.85 | 13.44 | 23.93 | 229 | 0 |
| preparado | 1 | 3/3 | 0.65 | 8.31 | 0.00 | — | 142 | 0 |
| preparado | 2 | 3/3 | 0.65 | 8.31 | 0.00 | — | 142 | 0 |
| preparado | 3 | 3/3 | 0.65 | 8.31 | 12.67 | — | 181 | 0 |
| preparado | 4 | 0/3 | 0.65 | 8.28 | 12.64 | — | 181 | 0 |
| preparado | 5 | 0/3 | 0.65 | 8.28 | 12.64 | — | 181 | 0 |
| preparado | 6 | 0/3 | 0.65 | 8.28 | 12.64 | 22.72 | 236 | 0 |
| preparado | 7 | 0/3 | 0.65 | 8.28 | 12.64 | — | 181 | 0 |
| preparado | 8 | 0/3 | 0.65 | 8.29 | 12.64 | 22.68 | 237 | 0 |
| preparado | 9 | 0/3 | 0.65 | 8.29 | 12.64 | — | 181 | 0 |
| preparado | 10 | 0/3 | 0.65 | 8.29 | 12.64 | 22.68 | 237 | 0 |
| original | 1 | 3/3 | 0.52 | 7.79 | 0.00 | — | 143 | 0 |
| original | 2 | 3/3 | 0.52 | 7.79 | 0.00 | — | 143 | 0 |
| original | 3 | 3/3 | 0.52 | 7.79 | 12.22 | — | 179 | 0 |
| original | 4 | 3/3 | 0.52 | 7.79 | 12.22 | — | 179 | 0 |
| original | 5 | 0/3 | 0.52 | 7.79 | 12.22 | — | 179 | 0 |
| original | 6 | 0/3 | 0.52 | 7.79 | 12.22 | 22.54 | 231 | 0 |
| original | 7 | 0/3 | 0.52 | 7.79 | 12.22 | — | 179 | 0 |
| original | 8 | 0/3 | 0.52 | 7.78 | 12.21 | 22.49 | 232 | 0 |
| original | 9 | 0/3 | 0.52 | 7.78 | 12.21 | — | 179 | 0 |
| original | 10 | 0/3 | 0.52 | 7.78 | 12.21 | 22.49 | 232 | 0 |
| Stage 2 preparado | 1 | 3/3 | 0.52 | 7.14 | 0.00 | — | 156 | 0 |
| Stage 2 preparado | 2 | 3/3 | 0.52 | 7.14 | 0.00 | — | 156 | 0 |
| Stage 2 preparado | 3 | 3/3 | 0.52 | 7.14 | 11.19 | — | 196 | 0 |
| Stage 2 preparado | 4 | 3/3 | 0.52 | 7.14 | 11.19 | — | 195 | 0 |
| Stage 2 preparado | 5 | 3/3 | 0.52 | 7.14 | 11.19 | — | 195 | 0 |
| Stage 2 preparado | 6 | 2/3 | 0.52 | 7.14 | 11.19 | 20.64 | 252 | 0 |
| Stage 2 preparado | 7 | 2/3 | 0.52 | 7.14 | 11.19 | — | 195 | 0 |
| Stage 2 preparado | 8 | 3/3 | 0.52 | 7.13 | 11.18 | 20.60 | 253 | 0 |
| Stage 2 preparado | 9 | 0/3 | 0.52 | 7.13 | 11.18 | — | 196 | 0 |
| Stage 2 preparado | 10 | 0/3 | 0.52 | 7.13 | 11.18 | 20.60 | 253 | 0 |
| original | 1 | 3/3 | 0.56 | 8.15 | 0.00 | — | 138 | 0 |
| original | 2 | 3/3 | 0.56 | 8.15 | 0.00 | — | 138 | 0 |
| original | 3 | 3/3 | 0.56 | 8.15 | 12.73 | — | 173 | 0 |
| original | 4 | 1/3 | 0.56 | 8.15 | 12.73 | — | 173 | 0 |
| original | 5 | 0/3 | 0.56 | 8.15 | 12.73 | — | 173 | 0 |
| original | 6 | 0/3 | 0.56 | 8.15 | 12.73 | 23.43 | 222 | 0 |
| original | 7 | 0/3 | 0.56 | 8.15 | 12.73 | — | 173 | 0 |
| original | 8 | 0/3 | 0.56 | 8.14 | 12.72 | 23.37 | 224 | 0 |
| original | 9 | 0/3 | 0.56 | 8.14 | 12.72 | — | 173 | 0 |
| original | 10 | 0/3 | 0.56 | 8.14 | 12.72 | 23.37 | 224 | 0 |
| Stage 2 preparado | 1 | 3/3 | 0.55 | 7.37 | 0.00 | — | 152 | 0 |
| Stage 2 preparado | 2 | 3/3 | 0.55 | 7.37 | 0.00 | — | 152 | 0 |
| Stage 2 preparado | 3 | 3/3 | 0.55 | 7.37 | 11.54 | — | 190 | 0 |
| Stage 2 preparado | 4 | 3/3 | 0.55 | 7.36 | 11.53 | — | 190 | 0 |
| Stage 2 preparado | 5 | 3/3 | 0.55 | 7.36 | 11.53 | — | 190 | 0 |
| Stage 2 preparado | 6 | 0/3 | 0.55 | 7.36 | 11.53 | 21.26 | 245 | 0 |
| Stage 2 preparado | 7 | 0/3 | 0.55 | 7.36 | 11.53 | — | 190 | 0 |
| Stage 2 preparado | 8 | 2/3 | 0.55 | 7.36 | 11.52 | 21.22 | 246 | 0 |
| Stage 2 preparado | 9 | 0/3 | 0.55 | 7.36 | 11.52 | — | 190 | 0 |
| Stage 2 preparado | 10 | 0/3 | 0.55 | 7.36 | 11.52 | 21.22 | 246 | 0 |
| original | 1 | 3/3 | 0.61 | 7.84 | 0.00 | — | 143 | 0 |
| original | 2 | 3/3 | 0.61 | 7.84 | 0.00 | — | 143 | 0 |
| original | 3 | 3/3 | 0.61 | 7.84 | 12.25 | — | 180 | 0 |
| original | 4 | 3/3 | 0.61 | 7.84 | 12.26 | — | 179 | 0 |
| original | 5 | 0/3 | 0.61 | 7.84 | 12.26 | — | 179 | 0 |
| original | 6 | 0/3 | 0.61 | 7.84 | 12.26 | 22.56 | 231 | 0 |
| original | 7 | 0/3 | 0.61 | 7.84 | 12.26 | — | 179 | 0 |
| original | 8 | 0/3 | 0.61 | 7.83 | 12.24 | 22.50 | 232 | 0 |
| original | 9 | 0/3 | 0.61 | 7.83 | 12.24 | — | 180 | 0 |
| original | 10 | 0/3 | 0.61 | 7.83 | 12.24 | 22.50 | 232 | 0 |
| Stage 2 preparado | 1 | 3/3 | 0.59 | 7.18 | 0.00 | — | 156 | 0 |
| Stage 2 preparado | 2 | 3/3 | 0.59 | 7.18 | 0.00 | — | 156 | 0 |
| Stage 2 preparado | 3 | 3/3 | 0.59 | 7.18 | 11.21 | — | 196 | 0 |
| Stage 2 preparado | 4 | 3/3 | 0.59 | 7.18 | 11.21 | — | 196 | 0 |
| Stage 2 preparado | 5 | 3/3 | 0.59 | 7.18 | 11.21 | — | 196 | 0 |
| Stage 2 preparado | 6 | 2/3 | 0.59 | 7.18 | 11.21 | 20.64 | 252 | 0 |
| Stage 2 preparado | 7 | 0/3 | 0.59 | 7.18 | 11.21 | — | 196 | 0 |
| Stage 2 preparado | 8 | 3/3 | 0.60 | 7.17 | 11.20 | 20.59 | 254 | 0 |
| Stage 2 preparado | 9 | 0/3 | 0.60 | 7.17 | 11.20 | — | 197 | 0 |
| Stage 2 preparado | 10 | 0/3 | 0.59 | 7.17 | 11.20 | 20.59 | 254 | 0 |
| original | 1 | 3/3 | 0.57 | 7.79 | 0.00 | — | 160 | 0 |
| original | 2 | 3/3 | 0.57 | 7.79 | 0.00 | — | 160 | 0 |
| original | 3 | 3/3 | 0.57 | 7.79 | 11.72 | — | 203 | 0 |
| original | 4 | 3/3 | 0.56 | 7.75 | 11.67 | — | 202 | 0 |
| original | 5 | 3/3 | 0.56 | 7.75 | 11.67 | — | 202 | 0 |
| original | 6 | 0/3 | 0.56 | 7.75 | 11.67 | 20.82 | 260 | 0 |
| original | 7 | 0/3 | 0.56 | 7.76 | 11.68 | — | 202 | 0 |
| original | 8 | 3/3 | 0.57 | 7.78 | 11.70 | 20.81 | 262 | 0 |
| original | 9 | 0/3 | 0.57 | 7.78 | 11.70 | — | 203 | 0 |
| original | 10 | 0/3 | 0.57 | 7.80 | 11.72 | 20.83 | 262 | 0 |
| Stage 2 preparado | 1 | 3/3 | 0.55 | 6.95 | 0.00 | — | 175 | 0 |
| Stage 2 preparado | 2 | 3/3 | 0.55 | 6.95 | 0.00 | — | 175 | 0 |
| Stage 2 preparado | 3 | 3/3 | 0.55 | 6.95 | 10.54 | — | 221 | 0 |
| Stage 2 preparado | 4 | 3/3 | 0.55 | 6.87 | 10.45 | — | 221 | 0 |
| Stage 2 preparado | 5 | 3/3 | 0.55 | 6.87 | 10.45 | — | 221 | 0 |
| Stage 2 preparado | 6 | 3/3 | 0.55 | 6.87 | 10.45 | 18.82 | 284 | 0 |
| Stage 2 preparado | 7 | 3/3 | 0.54 | 6.87 | 10.46 | — | 221 | 0 |
| Stage 2 preparado | 8 | 3/3 | 0.55 | 6.90 | 10.47 | 18.81 | 285 | 0 |
| Stage 2 preparado | 9 | 0/3 | 0.55 | 6.91 | 10.48 | — | 221 | 0 |
| Stage 2 preparado | 10 | 0/3 | 0.55 | 6.90 | 10.47 | 18.81 | 285 | 0 |
| original | 1 | 3/3 | 0.76 | 7.26 | 0.00 | — | 156 | 0 |
| original | 2 | 3/3 | 0.76 | 7.26 | 0.00 | — | 156 | 0 |
| original | 3 | 3/3 | 0.76 | 7.26 | 11.27 | — | 199 | 0 |
| original | 4 | 3/3 | 0.76 | 7.26 | 11.26 | — | 198 | 0 |
| original | 5 | 3/3 | 0.76 | 7.26 | 11.26 | — | 198 | 0 |
| original | 6 | 1/3 | 0.76 | 7.26 | 11.26 | 20.50 | 258 | 0 |
| original | 7 | 0/3 | 0.76 | 7.26 | 11.26 | — | 198 | 0 |
| original | 8 | 3/3 | 0.76 | 7.26 | 11.26 | 20.46 | 260 | 0 |
| original | 9 | 0/3 | 0.76 | 7.26 | 11.26 | — | 199 | 0 |
| original | 10 | 0/3 | 0.76 | 7.26 | 11.26 | 20.46 | 260 | 0 |
| Stage 2 preparado | 1 | 3/3 | 0.72 | 6.55 | 0.00 | — | 174 | 0 |
| Stage 2 preparado | 2 | 3/3 | 0.72 | 6.55 | 0.00 | — | 174 | 0 |
| Stage 2 preparado | 3 | 3/3 | 0.72 | 6.55 | 10.16 | — | 220 | 0 |
| Stage 2 preparado | 4 | 3/3 | 0.72 | 6.54 | 10.15 | — | 220 | 0 |
| Stage 2 preparado | 5 | 3/3 | 0.72 | 6.54 | 10.15 | — | 220 | 0 |
| Stage 2 preparado | 6 | 3/3 | 0.72 | 6.54 | 10.15 | 18.51 | 287 | 0 |
| Stage 2 preparado | 7 | 3/3 | 0.72 | 6.54 | 10.15 | — | 220 | 0 |
| Stage 2 preparado | 8 | 3/3 | 0.72 | 6.54 | 10.15 | 18.49 | 288 | 0 |
| Stage 2 preparado | 9 | 3/3 | 0.72 | 6.54 | 10.15 | — | 220 | 0 |
| Stage 2 preparado | 10 | 0/3 | 0.72 | 6.54 | 10.15 | 18.49 | 288 | 0 |
