# Balanceamento — Capítulo 2 (gerado por scripts/balance-chapter2.ts)

## Builds preparados (pista de testes, piloto avançado)

| carro | build | custo | cv | N·m | boost máx. | 0–100 | 201 m | 402 m | vel. 402 m | patinagem | trocas | câmbio |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| gm-astra-2011 | original | 0 | 140 | 193 | — | 9.28 | 10.93 | 16.70 | 189 km/h | 0.84 s | 4 | manual |
| gm-astra-2011 | remap aspirado | 1800 | 144 | 199 | — | 8.93 | 10.79 | 16.47 | 192 km/h | 1.62 s | 4 | manual |
| gm-astra-2011 | aspirado preparado | 13200 | 177 | 222 | — | 7.79 | 10.32 | 15.66 | 209 km/h | 1.44 s | 4 | manual |
| peugeot-208-gt-2017 | original | 0 | 173 | 240 | — | 7.63 | 10.23 | 15.54 | 212 km/h | 1.72 s | 4 | manual |
| peugeot-208-gt-2017 | Stage 1 | 2500 | 198 | 278 | 1.30 bar | 7.11 | 10.01 | 15.09 | 223 km/h | 1.72 s | 5 | manual |
| peugeot-208-gt-2017 | preparado | 9450 | 217 | 281 | 1.30 bar | 6.83 | 9.83 | 14.81 | 230 km/h | 1.67 s | 5 | manual |
| vw-golf-gti-mk4-2003 | original | 0 | 180 | 235 | — | 7.76 | 10.31 | 15.64 | 210 km/h | 1.82 s | 4 | manual |
| vw-golf-gti-mk4-2003 | Stage 1 | 3400 | 206 | 278 | 1.10 bar | 7.16 | 10.05 | 15.14 | 222 km/h | 1.82 s | 4 | manual |
| vw-golf-gti-mk4-2003 | preparado | 14450 | 225 | 305 | 1.10 bar | 6.71 | 9.77 | 14.73 | 228 km/h | 1.57 s | 4 | manual |
| audi-a3-18t-2005 | original | 0 | 180 | 235 | — | 7.90 | 10.37 | 15.74 | 210 km/h | 1.82 s | 4 | manual |
| audi-a3-18t-2005 | Stage 1 | 3400 | 206 | 278 | 1.10 bar | 7.27 | 10.11 | 15.23 | 222 km/h | 2.22 s | 5 | manual |
| audi-a3-18t-2005 | preparado | 14450 | 225 | 305 | 1.10 bar | 6.79 | 9.83 | 14.82 | 229 km/h | 1.59 s | 5 | manual |
| mercedes-c200-w205-2015 | original | 0 | 184 | 300 | — | 7.46 | 10.17 | 15.52 | 213 km/h | 0.70 s | 4 | torque-converter-auto |
| mercedes-c200-w205-2015 | Stage 1 | 2500 | 216 | 349 | 1.30 bar | 6.68 | 9.80 | 14.88 | 228 km/h | 0.96 s | 4 | torque-converter-auto |
| mercedes-c200-w205-2015 | preparado | 11900 | 235 | 357 | 1.30 bar | 6.15 | 9.43 | 14.39 | 234 km/h | 0.71 s | 4 | torque-converter-auto |
| bmw-320i-f30-2014 | original | 0 | 184 | 270 | — | 7.21 | 9.98 | 15.36 | 210 km/h | 0.89 s | 5 | torque-converter-auto |
| bmw-320i-f30-2014 | Stage 1 | 2500 | 216 | 317 | 1.20 bar | 6.47 | 9.66 | 14.74 | 225 km/h | 1.30 s | 5 | torque-converter-auto |
| bmw-320i-f30-2014 | preparado | 11900 | 234 | 342 | 1.20 bar | 6.00 | 9.34 | 14.30 | 230 km/h | 0.41 s | 5 | torque-converter-auto |
| honda-civic-si-2008 | original | 0 | 192 | 188 | — | 7.83 | 10.37 | 15.68 | 214 km/h | 0.58 s | 5 | manual |
| honda-civic-si-2008 | remap aspirado | 1800 | 198 | 194 | — | 7.54 | 10.23 | 15.45 | 218 km/h | 0.60 s | 5 | manual |
| honda-civic-si-2008 | aspirado preparado | 13500 | 240 | 218 | — | 7.11 | 10.03 | 15.00 | 233 km/h | 1.12 s | 5 | manual |
| vw-jetta-tsi-2012 | original | 0 | 200 | 280 | — | 7.04 | 10.02 | 15.14 | 221 km/h | 2.45 s | 4 | dual-clutch |
| vw-jetta-tsi-2012 | Stage 1 | 2500 | 235 | 329 | 1.20 bar | 6.63 | 9.83 | 14.72 | 236 km/h | 2.34 s | 4 | dual-clutch |
| vw-jetta-tsi-2012 | preparado | 13550 | 255 | 357 | 1.20 bar | 6.25 | 9.59 | 14.36 | 242 km/h | 1.98 s | 5 | dual-clutch |
| mitsubishi-evo-x-2012 | original | 0 | 295 | 366 | — | 5.32 | 8.89 | 13.66 | 238 km/h | 0.00 s | 5 | dual-clutch |
| mitsubishi-evo-x-2012 | Stage 1 | 2500 | 336 | 416 | 1.55 bar | 4.75 | 8.52 | 13.08 | 253 km/h | 0.02 s | 5 | dual-clutch |
| mitsubishi-evo-x-2012 | preparado | 17100 | 369 | 442 | 1.55 bar | 4.32 | 8.20 | 12.63 | 262 km/h | 0.12 s | 5 | dual-clutch |
| bmw-335i-f30-2013 | original | 0 | 306 | 400 | — | 5.53 | 9.09 | 13.71 | 255 km/h | 1.45 s | 5 | torque-converter-auto |
| bmw-335i-f30-2013 | Stage 1 | 2500 | 352 | 470 | 1.15 bar | 5.24 | 8.90 | 13.32 | 272 km/h | 1.50 s | 6 | torque-converter-auto |
| bmw-335i-f30-2013 | preparado | 19250 | 387 | 515 | 1.15 bar | 4.73 | 8.51 | 12.81 | 279 km/h | 1.30 s | 6 | torque-converter-auto |

## Rivais

- 1. Portas Abertas — Gustavo "Guga": Chevrolet Astra 2.0 Flexpower 2011 (preparado), 146 cv, 195 N·m, 1300 kg, peças [filter-sport, exhaust-sport], RT médio 0.26 s, prêmio 2500 CR
- 2. Turbo Francês — Camila "THP": Peugeot 208 GT 1.6 THP 2017 (preparado), 173 cv, 240 N·m, 1274 kg, peças [tires-sport], RT médio 0.23 s, prêmio 3500 CR
- 3. A Lenda do GTI — Ricardo "GTI": Volkswagen Golf GTI 1.8T 2003 (preparado), 206 cv, 278 N·m, 1340 kg, peças [ecu-stage1, clutch-reinforced], RT médio 0.22 s, prêmio 4500 CR
- 4. Quatro Argolas — André "A3": Audi A3 1.8T 2005 (preparado), 206 cv, 278 N·m, 1365 kg, peças [ecu-stage1, boost-control, clutch-reinforced], RT médio 0.21 s, prêmio 5500 CR
- 5. Precisão Alemã — Helena "C200": Mercedes-Benz C200 W205 2015 (preparado), 216 cv, 349 N·m, 1580 kg, peças [ecu-stage1], RT médio 0.2 s, prêmio 6500 CR
- 6. Tração Traseira — Daniel "320": BMW 320i F30 2014 (preparado), 216 cv, 317 N·m, 1550 kg, peças [ecu-stage1, at-upgrade, suspension-drag-rwd, tires-semislick], RT médio 0.2 s, prêmio 7500 CR
- 7. VTEC — Lucas "Si": Honda Civic Si 2008 (preparado), 240 cv, 218 N·m, 1363 kg, peças [filter-sport, exhaust-sport, manifold-k20-rbc, cam-k20, head-ported, ecu-stage1-na, tires-semislick], RT médio 0.19 s, prêmio 8500 CR
- 8. Troca Perfeita — Felipe "TSI": Volkswagen Jetta Highline TSI 2012 (preparado), 255 cv, 357 N·m, 1456 kg, peças [ecu-stage1, dct-upgrade, intercooler-race, exhaust-sport, tires-semislick], RT médio 0.18 s, prêmio 10000 CR
- 9. Tração Total — Bianca "Evo": Mitsubishi Lancer Evolution X 2012 (preparado), 295 cv, 366 N·m, 1665 kg, peças [awd-center-tune, tires-sport], RT médio 0.17 s, prêmio 13000 CR
- 10. O Dono da Liga — Victor "335": BMW 335i M Sport F30 2013 (preparado), 352 cv, 470 N·m, 1660 kg, peças [ecu-stage1, at-upgrade, tires-semislick, suspension-drag-rwd], RT médio 0.16 s, prêmio 20000 CR

## Corridas contra os rivais (total = RT + ET, s; V = jogador vence)

Sementes: jogador 1000 + i, rival 2000 + i, corrida 3000 + i. Pista e distância do evento.

| carro | build | piloto | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| vw-gol-gts-1988 (cap. 1) | turbo do cap. 1 | intermediate | V 10.97/11.49 | · 11.04/10.97 | · 16.20/15.87 | · 16.05/15.92 | · 15.91/15.32 | · 16.08/14.97 | · 16.13/15.58 | · 16.00/14.97 | · 15.88/14.23 | · 15.96/13.68 |
| vw-gol-gts-1988 (cap. 1) | turbo do cap. 1 | advanced | V 10.69/11.55 | V 10.67/11.07 | V 15.81/15.90 | V 15.70/15.88 | · 15.77/15.27 | · 15.72/14.93 | · 15.76/15.63 | · 15.66/15.03 | · 15.62/14.22 | · 15.64/13.69 |
| gm-astra-2011 | original | intermediate | · 11.66/11.58 | · 11.70/10.87 | · 17.57/15.91 | · 17.64/15.90 | · 17.49/15.28 | · 17.52/14.92 | · 17.28/15.56 | · 17.45/14.94 | · 17.42/14.23 | · 17.47/13.66 |
| gm-astra-2011 | original | advanced | V 11.43/11.65 | · 11.47/11.11 | · 17.22/15.83 | · 17.17/15.95 | · 17.16/15.32 | · 17.19/14.91 | · 17.15/15.61 | · 17.09/14.96 | · 17.20/14.20 | · 17.15/13.64 |
| gm-astra-2011 | remap aspirado | intermediate | V 11.45/11.53 | · 11.64/11.09 | · 17.41/15.90 | · 17.20/15.89 | · 17.21/15.32 | · 17.18/14.98 | · 17.29/15.59 | · 17.19/14.95 | · 17.12/14.19 | · 17.25/13.68 |
| gm-astra-2011 | remap aspirado | advanced | V 11.34/11.58 | · 11.31/11.02 | · 16.96/15.90 | · 16.91/15.92 | · 16.93/15.28 | · 16.96/14.94 | · 17.00/15.65 | · 16.86/14.97 | · 16.89/14.22 | · 16.89/13.71 |
| gm-astra-2011 | aspirado preparado | intermediate | V 11.29/11.58 | · 11.23/11.02 | · 16.55/15.88 | · 16.39/15.93 | · 16.63/15.29 | · 16.59/14.92 | · 16.66/15.62 | · 16.44/14.97 | · 16.49/14.22 | · 16.47/13.70 |
| gm-astra-2011 | aspirado preparado | advanced | V 10.92/11.58 | V 10.88/11.02 | · 16.24/15.93 | · 16.23/15.93 | · 16.28/15.35 | · 16.33/14.92 | · 16.28/15.63 | · 16.15/14.98 | · 16.18/14.20 | · 16.16/13.69 |
| peugeot-208-gt-2017 | original | intermediate | V 10.99/11.55 | · 11.03/10.94 | · 16.50/15.90 | · 16.22/15.90 | · 16.24/15.34 | · 16.35/14.97 | · 16.29/15.59 | · 15.80/14.96 | · 16.13/14.19 | · 16.31/13.65 |
| peugeot-208-gt-2017 | original | advanced | V 10.74/11.53 | V 10.76/11.01 | · 16.07/15.95 | · 16.00/15.91 | · 16.07/15.35 | · 16.05/14.92 | · 16.05/15.63 | · 15.97/14.92 | · 15.98/14.16 | · 15.98/13.69 |
| peugeot-208-gt-2017 | Stage 1 | intermediate | V 10.85/11.58 | V 10.88/11.03 | · 16.01/15.86 | V 15.89/15.90 | · 15.88/15.31 | · 15.88/14.95 | · 15.81/15.63 | · 15.96/14.96 | · 15.85/14.18 | · 15.76/13.65 |
| peugeot-208-gt-2017 | Stage 1 | advanced | V 10.60/11.63 | V 10.54/11.01 | V 15.61/15.85 | V 15.57/15.90 | · 15.58/15.33 | · 15.57/14.96 | · 15.62/15.59 | · 15.54/14.95 | · 15.58/14.23 | · 15.54/13.67 |
| peugeot-208-gt-2017 | preparado | intermediate | V 10.72/11.56 | V 10.78/11.04 | V 15.69/15.90 | V 15.53/15.95 | · 15.60/15.30 | · 15.69/14.92 | · 15.68/15.60 | · 15.71/14.97 | · 15.65/14.21 | · 15.66/13.67 |
| peugeot-208-gt-2017 | preparado | advanced | V 10.39/11.57 | V 10.39/11.07 | V 15.37/15.89 | V 15.35/15.94 | V 15.35/15.36 | · 15.37/14.92 | V 15.38/15.57 | · 15.28/15.01 | · 15.33/14.23 | · 15.27/13.69 |
| vw-golf-gti-mk4-2003 | original | intermediate | V 11.07/11.49 | · 11.11/11.00 | · 16.67/15.86 | · 16.54/15.94 | · 16.50/15.33 | · 16.54/14.94 | · 16.40/15.57 | · 16.54/14.98 | · 16.45/14.23 | · 16.41/13.65 |
| vw-golf-gti-mk4-2003 | original | advanced | V 10.88/11.49 | V 10.94/10.95 | · 16.27/15.89 | · 16.16/15.92 | · 16.25/15.26 | · 16.17/14.94 | · 16.20/15.59 | · 16.16/14.95 | · 16.13/14.24 | · 16.15/13.67 |
| vw-golf-gti-mk4-2003 | Stage 1 | intermediate | V 11.01/11.53 | V 10.91/11.00 | · 16.13/15.91 | · 16.00/15.96 | · 16.14/15.32 | · 15.94/14.94 | · 15.93/15.66 | · 15.91/14.98 | · 15.82/14.20 | · 15.98/13.65 |
| vw-golf-gti-mk4-2003 | Stage 1 | advanced | V 10.64/11.59 | V 10.69/10.97 | V 15.77/15.87 | V 15.75/15.87 | · 15.77/15.33 | · 15.77/14.94 | · 15.70/15.59 | · 15.67/14.99 | · 15.66/14.19 | · 15.69/13.66 |
| vw-golf-gti-mk4-2003 | preparado | intermediate | V 10.79/11.56 | V 10.84/11.01 | V 15.71/15.89 | V 15.70/15.88 | · 15.68/15.34 | · 15.70/14.98 | · 15.82/15.61 | · 15.67/14.97 | · 15.64/14.17 | · 15.73/13.66 |
| vw-golf-gti-mk4-2003 | preparado | advanced | V 10.43/11.60 | V 10.42/11.03 | V 15.42/15.89 | V 15.40/15.88 | V 15.35/15.35 | · 15.37/14.95 | V 15.40/15.63 | · 15.36/14.94 | · 15.34/14.18 | · 15.33/13.64 |
| audi-a3-18t-2005 | original | intermediate | V 11.35/11.56 | · 11.31/10.98 | · 16.64/15.86 | · 16.63/15.92 | · 16.76/15.28 | · 16.66/14.89 | · 16.65/15.59 | · 16.48/14.96 | · 16.63/14.22 | · 16.49/13.66 |
| audi-a3-18t-2005 | original | advanced | V 10.97/11.59 | V 11.01/11.04 | · 16.29/15.90 | · 16.29/15.93 | · 16.27/15.35 | · 16.32/14.93 | · 16.30/15.61 | · 16.25/14.97 | · 16.24/14.19 | · 16.25/13.65 |
| audi-a3-18t-2005 | Stage 1 | intermediate | V 10.91/11.54 | V 10.87/11.08 | · 16.26/15.90 | · 16.29/15.96 | · 16.07/15.33 | · 16.12/14.98 | · 16.00/15.63 | · 15.95/14.98 | · 15.98/14.18 | · 15.60/13.66 |
| audi-a3-18t-2005 | Stage 1 | advanced | V 10.72/11.59 | V 10.72/11.03 | V 15.83/15.86 | · 15.83/15.83 | · 15.85/15.28 | · 15.87/14.92 | · 15.78/15.63 | · 15.75/15.01 | · 15.74/14.20 | · 15.78/13.69 |
| audi-a3-18t-2005 | preparado | intermediate | V 10.82/11.56 | V 10.79/11.00 | V 15.87/15.88 | · 15.90/15.87 | · 15.76/15.30 | · 15.82/14.98 | · 15.74/15.60 | · 15.65/15.00 | · 15.86/14.21 | · 15.72/13.68 |
| audi-a3-18t-2005 | preparado | advanced | V 10.54/11.63 | V 10.50/10.92 | V 15.53/15.90 | V 15.48/15.93 | · 15.45/15.34 | · 15.49/14.93 | V 15.47/15.62 | · 15.39/14.96 | · 15.40/14.20 | · 15.40/13.66 |
| mercedes-c200-w205-2015 | original | intermediate | V 10.88/11.59 | V 10.85/10.97 | · 16.16/15.91 | V 15.84/15.92 | · 16.16/15.29 | · 16.18/14.92 | · 16.32/15.57 | · 15.94/14.96 | · 16.12/14.20 | · 15.96/13.69 |
| mercedes-c200-w205-2015 | original | advanced | V 10.50/11.63 | V 10.54/11.02 | · 15.88/15.87 | V 15.81/15.89 | · 15.89/15.28 | · 15.84/14.94 | · 15.83/15.58 | · 15.82/14.99 | · 15.82/14.22 | · 15.72/13.66 |
| mercedes-c200-w205-2015 | Stage 1 | intermediate | V 10.29/11.59 | V 10.30/11.03 | V 15.23/15.90 | V 15.35/15.89 | V 15.24/15.29 | · 15.30/14.98 | V 15.12/15.56 | · 15.27/14.97 | · 15.33/14.19 | · 15.29/13.67 |
| mercedes-c200-w205-2015 | Stage 1 | advanced | V 10.22/11.54 | V 10.26/11.01 | V 15.33/15.95 | V 15.31/15.92 | V 15.30/15.35 | · 15.26/14.90 | V 15.25/15.57 | · 15.14/14.95 | · 15.17/14.21 | · 15.20/13.67 |
| mercedes-c200-w205-2015 | preparado | intermediate | V 10.16/11.54 | V 10.21/10.95 | V 15.18/15.85 | V 15.11/15.91 | V 15.11/15.31 | · 15.13/14.88 | V 15.04/15.62 | · 15.11/14.95 | · 15.10/14.22 | · 15.20/13.70 |
| mercedes-c200-w205-2015 | preparado | advanced | V 9.98/11.58 | V 9.96/11.01 | V 14.99/15.91 | V 14.98/15.90 | V 14.91/15.25 | V 14.95/14.97 | V 15.00/15.62 | V 14.83/14.97 | · 14.87/14.20 | · 14.84/13.66 |
| bmw-320i-f30-2014 | original | intermediate | V 10.64/11.50 | V 10.49/10.99 | · 15.94/15.89 | V 15.83/15.90 | · 15.92/15.28 | · 15.89/14.95 | · 15.90/15.59 | · 15.73/14.99 | · 15.80/14.21 | · 15.85/13.66 |
| bmw-320i-f30-2014 | original | advanced | V 10.42/11.55 | V 10.42/10.98 | V 15.78/15.85 | V 15.75/15.91 | · 15.74/15.25 | · 15.71/14.92 | · 15.75/15.63 | · 15.68/15.02 | · 15.71/14.16 | · 15.72/13.67 |
| bmw-320i-f30-2014 | Stage 1 | intermediate | V 10.02/11.56 | V 9.90/10.98 | V 15.13/15.91 | V 15.09/15.90 | V 15.11/15.30 | · 15.02/14.96 | V 15.10/15.62 | · 15.00/14.98 | · 15.04/14.20 | · 15.04/13.67 |
| bmw-320i-f30-2014 | Stage 1 | advanced | V 9.98/11.60 | V 10.04/11.07 | V 15.10/15.86 | V 15.05/15.90 | V 14.99/15.28 | · 15.05/14.93 | V 14.99/15.61 | · 14.98/14.97 | · 14.93/14.19 | · 14.93/13.65 |
| bmw-320i-f30-2014 | preparado | intermediate | V 9.80/11.64 | V 9.75/10.98 | V 14.81/15.88 | V 14.75/15.91 | V 14.83/15.33 | V 14.81/14.98 | V 14.71/15.62 | V 14.28/14.95 | · 14.65/14.20 | · 14.55/13.66 |
| bmw-320i-f30-2014 | preparado | advanced | V 9.75/11.62 | V 9.75/11.01 | V 14.74/15.84 | V 14.73/15.85 | V 14.69/15.33 | V 14.64/14.96 | V 14.66/15.61 | V 14.62/14.97 | · 14.56/14.21 | · 14.57/13.66 |
| honda-civic-si-2008 | original | intermediate | V 11.09/11.64 | · 11.14/11.01 | · 16.53/15.93 | · 16.54/15.93 | · 16.55/15.29 | · 16.40/14.96 | · 16.58/15.62 | · 16.50/14.95 | · 16.51/14.18 | · 16.44/13.67 |
| honda-civic-si-2008 | original | advanced | V 10.92/11.48 | · 10.94/10.94 | · 16.23/15.88 | · 16.19/15.90 | · 16.22/15.29 | · 16.21/14.90 | · 16.24/15.62 | · 16.17/15.01 | · 16.17/14.21 | · 16.20/13.68 |
| honda-civic-si-2008 | remap aspirado | intermediate | V 10.92/11.59 | · 11.11/11.01 | · 16.31/15.92 | · 16.32/15.91 | · 16.29/15.34 | · 16.29/14.90 | · 16.27/15.63 | · 16.13/14.96 | · 16.35/14.20 | · 16.15/13.66 |
| honda-civic-si-2008 | remap aspirado | advanced | V 10.78/11.59 | V 10.79/10.97 | · 16.03/15.81 | · 15.95/15.90 | · 15.91/15.36 | · 16.01/14.96 | · 16.00/15.60 | · 15.95/14.99 | · 15.94/14.21 | · 15.91/13.68 |
| honda-civic-si-2008 | aspirado preparado | intermediate | V 11.03/11.57 | V 10.92/11.05 | V 15.86/15.89 | V 15.90/15.91 | · 15.85/15.33 | · 15.85/14.91 | · 15.78/15.65 | · 15.91/14.96 | · 15.80/14.21 | · 15.71/13.66 |
| honda-civic-si-2008 | aspirado preparado | advanced | V 10.53/11.60 | V 10.52/10.98 | V 15.52/15.83 | V 15.42/15.93 | · 15.47/15.35 | · 15.48/14.94 | V 15.44/15.59 | · 15.54/14.94 | · 15.51/14.21 | · 15.54/13.66 |
| vw-jetta-tsi-2012 | original | intermediate | V 10.66/11.56 | V 10.87/10.95 | · 15.98/15.88 | V 15.89/15.90 | · 16.00/15.35 | · 15.81/14.93 | · 15.98/15.66 | · 15.95/14.98 | · 15.69/14.20 | · 15.81/13.68 |
| vw-jetta-tsi-2012 | original | advanced | V 10.62/11.52 | V 10.63/11.10 | V 15.73/15.91 | V 15.76/15.94 | · 15.73/15.29 | · 15.69/14.93 | · 15.75/15.59 | · 15.64/14.94 | · 15.62/14.21 | · 15.64/13.68 |
| vw-jetta-tsi-2012 | Stage 1 | intermediate | V 10.68/11.60 | V 10.64/11.02 | V 15.52/15.89 | V 15.48/15.93 | · 15.55/15.34 | · 15.45/14.93 | V 15.50/15.61 | · 15.34/14.99 | · 15.51/14.22 | · 15.37/13.67 |
| vw-jetta-tsi-2012 | Stage 1 | advanced | V 10.40/11.54 | V 10.41/10.94 | V 15.34/15.90 | V 15.29/15.90 | · 15.33/15.32 | · 15.28/14.94 | V 15.34/15.61 | · 15.21/14.95 | · 15.26/14.25 | · 15.18/13.66 |
| vw-jetta-tsi-2012 | preparado | intermediate | V 10.52/11.54 | V 10.64/11.02 | V 15.33/15.91 | V 15.40/15.94 | · 15.33/15.25 | · 15.21/14.93 | V 15.37/15.61 | · 15.24/14.96 | · 15.21/14.20 | · 15.26/13.70 |
| vw-jetta-tsi-2012 | preparado | advanced | V 10.28/11.58 | V 10.27/10.99 | V 15.06/15.95 | V 15.05/15.94 | V 15.05/15.37 | · 15.06/14.95 | V 15.02/15.66 | V 14.96/14.97 | · 14.87/14.23 | · 14.97/13.69 |
| mitsubishi-evo-x-2012 | original | intermediate | V 9.37/11.68 | V 9.46/10.97 | V 14.23/15.90 | V 14.29/15.95 | V 14.22/15.35 | V 14.31/14.91 | V 14.26/15.60 | V 14.24/14.96 | · 14.23/14.23 | · 14.25/13.69 |
| mitsubishi-evo-x-2012 | original | advanced | V 9.34/11.58 | V 9.38/11.08 | V 14.19/15.89 | V 14.17/15.91 | V 14.23/15.28 | V 14.17/14.96 | V 14.19/15.60 | V 14.14/14.98 | · 14.18/14.18 | · 14.13/13.69 |
| mitsubishi-evo-x-2012 | Stage 1 | intermediate | V 9.11/11.60 | V 9.03/10.96 | V 13.72/15.91 | V 13.66/15.96 | V 13.58/15.27 | V 13.71/14.97 | V 13.80/15.57 | V 13.65/14.93 | V 13.68/14.22 | · 13.68/13.68 |
| mitsubishi-evo-x-2012 | Stage 1 | advanced | V 8.95/11.59 | V 9.02/10.98 | V 13.64/15.84 | V 13.59/15.94 | V 13.64/15.32 | V 13.61/14.93 | V 13.63/15.61 | V 13.56/14.95 | V 13.57/14.19 | V 13.61/13.67 |
| mitsubishi-evo-x-2012 | preparado | intermediate | V 8.88/11.60 | V 8.83/10.97 | V 13.28/15.88 | V 13.32/15.91 | V 13.19/15.27 | V 13.38/14.94 | V 13.35/15.60 | V 13.21/14.93 | V 13.18/14.18 | V 13.31/13.66 |
| mitsubishi-evo-x-2012 | preparado | advanced | V 8.70/11.55 | V 8.77/10.99 | V 13.18/15.87 | V 13.19/15.95 | V 13.19/15.33 | V 13.19/14.95 | V 13.12/15.62 | V 13.16/14.98 | V 13.17/14.21 | V 13.16/13.63 |
| bmw-335i-f30-2013 | original | intermediate | V 9.95/11.60 | V 9.82/11.08 | V 14.36/15.85 | V 14.22/15.93 | V 14.34/15.28 | V 14.36/14.95 | V 13.92/15.59 | V 14.21/14.97 | V 14.11/14.20 | · 14.26/13.69 |
| bmw-335i-f30-2013 | original | advanced | V 9.60/11.57 | V 9.62/11.06 | V 14.23/15.93 | V 14.17/15.91 | V 14.19/15.32 | V 14.21/14.95 | V 14.13/15.62 | V 14.10/14.97 | V 14.05/14.18 | · 14.09/13.69 |
| bmw-335i-f30-2013 | Stage 1 | intermediate | V 9.40/11.64 | V 9.56/10.98 | V 13.76/15.90 | V 14.05/15.95 | V 14.00/15.30 | V 13.81/14.91 | V 13.86/15.61 | V 13.65/14.97 | V 13.42/14.17 | · 13.88/13.67 |
| bmw-335i-f30-2013 | Stage 1 | advanced | V 9.41/11.60 | V 9.43/11.03 | V 13.87/15.90 | V 13.85/15.96 | V 13.78/15.33 | V 13.79/14.93 | V 13.79/15.61 | V 13.71/14.97 | V 13.70/14.19 | · 13.72/13.67 |
| bmw-335i-f30-2013 | preparado | intermediate | V 9.99/11.48 | V 9.49/10.95 | V 14.24/15.91 | V 14.01/15.91 | V 13.62/15.32 | V 13.63/14.97 | V 13.95/15.62 | V 13.60/14.94 | V 13.67/14.19 | · 13.73/13.68 |
| bmw-335i-f30-2013 | preparado | advanced | V 9.39/11.53 | V 9.34/11.01 | V 13.73/15.90 | V 13.63/15.95 | V 13.61/15.35 | V 13.64/14.97 | V 13.66/15.59 | V 13.53/14.94 | V 13.49/14.20 | V 13.50/13.69 |

## Campanha simulada (início: capítulo 1 concluído, Gol turbo, 4.000 CR, 200 de reputação; limite de 160 corridas; compra só com 3.000 CR de reserva para peças; repete o evento mais bem pago que o carro atual venceu por último)

| estratégia | piloto | corridas | derrotas | repetições pagas | carros comprados | CR gastos em peças | créditos finais | concluiu | parou em |
|---|---|---:|---:|---:|---|---:|---:|---|---|
| fica com o carro do cap. 1 e compra quando trava | intermediate | 66 | 29 | 27 | vw-golf-gti-mk4-2003, bmw-320i-f30-2014, mitsubishi-evo-x-2012 | 51300 | 20920 | sim | — |
| fica com o carro do cap. 1 e compra quando trava | advanced | 75 | 33 | 32 | vw-golf-gti-mk4-2003, bmw-320i-f30-2014, mitsubishi-evo-x-2012 | 49700 | 21420 | sim | — |
| compra o 208 cedo | intermediate | 150 | 71 | 69 | peugeot-208-gt-2017, mercedes-c200-w205-2015, mitsubishi-evo-x-2012 | 63300 | 108620 | sim | — |
| compra o 208 cedo | advanced | 74 | 32 | 32 | peugeot-208-gt-2017, mercedes-c200-w205-2015, mitsubishi-evo-x-2012 | 51300 | 20680 | sim | — |
| começa pela Astra, passa pelo Golf e pelo Civic | intermediate | 160 | 82 | 74 | gm-astra-2011, vw-golf-gti-mk4-2003, honda-civic-si-2008 | 30900 | 29000 | não | 5. Precisão Alemã (honda-civic-si-2008, 8 peças) |
| começa pela Astra, passa pelo Golf e pelo Civic | advanced | 160 | 78 | 78 | gm-astra-2011, vw-golf-gti-mk4-2003, honda-civic-si-2008 | 30900 | 37300 | não | 5. Precisão Alemã (honda-civic-si-2008, 8 peças) |
