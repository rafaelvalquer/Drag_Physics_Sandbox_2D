# Balanceamento — Capítulo 2 (gerado por scripts/balance-chapter2.ts)

## Builds preparados (pista de testes, piloto avançado)

| carro | build | custo | cv | N·m | boost máx. | 0–100 | 201 m | 402 m | vel. 402 m | patinagem | trocas | câmbio |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| gm-astra-2011 | original | 0 | 140 | 193 | — | 9.28 | 10.93 | 16.70 | 189 km/h | 0.84 s | 4 | manual |
| gm-astra-2011 | remap aspirado | 1800 | 144 | 199 | — | 8.93 | 10.79 | 16.47 | 192 km/h | 1.62 s | 4 | manual |
| gm-astra-2011 | aspirado preparado | 13200 | 177 | 222 | — | 7.64 | 10.23 | 15.53 | 210 km/h | 0.72 s | 4 | manual |
| peugeot-208-gt-2017 | original | 0 | 173 | 240 | — | 7.63 | 10.23 | 15.54 | 212 km/h | 1.72 s | 4 | manual |
| peugeot-208-gt-2017 | Stage 1 | 2500 | 198 | 278 | 1.30 bar | 7.09 | 9.99 | 15.07 | 223 km/h | 1.63 s | 5 | manual |
| peugeot-208-gt-2017 | preparado | 9450 | 215 | 281 | 1.30 bar | 6.50 | 9.59 | 14.54 | 232 km/h | 1.35 s | 5 | manual |
| vw-golf-gti-mk4-2003 | original | 0 | 180 | 235 | — | 7.76 | 10.31 | 15.64 | 210 km/h | 1.82 s | 4 | manual |
| vw-golf-gti-mk4-2003 | Stage 1 | 3400 | 206 | 278 | 1.10 bar | 7.17 | 10.06 | 15.15 | 222 km/h | 2.22 s | 4 | manual |
| vw-golf-gti-mk4-2003 | preparado | 14450 | 225 | 316 | 1.18 bar | 6.47 | 9.59 | 14.51 | 230 km/h | 1.42 s | 4 | manual |
| audi-a3-18t-2005 | original | 0 | 180 | 235 | — | 7.90 | 10.37 | 15.74 | 210 km/h | 1.82 s | 4 | manual |
| audi-a3-18t-2005 | Stage 1 | 3400 | 206 | 278 | 1.10 bar | 7.27 | 10.12 | 15.24 | 222 km/h | 2.17 s | 5 | manual |
| audi-a3-18t-2005 | preparado | 14450 | 225 | 316 | 1.18 bar | 6.53 | 9.65 | 14.60 | 232 km/h | 1.40 s | 5 | manual |
| mercedes-c200-w205-2015 | original | 0 | 184 | 300 | — | 7.46 | 10.17 | 15.52 | 213 km/h | 0.70 s | 4 | torque-converter-auto |
| mercedes-c200-w205-2015 | Stage 1 | 2500 | 215 | 349 | 1.30 bar | 6.64 | 9.76 | 14.84 | 228 km/h | 0.95 s | 4 | torque-converter-auto |
| mercedes-c200-w205-2015 | preparado | 11900 | 234 | 357 | 1.30 bar | 5.92 | 9.25 | 14.19 | 236 km/h | 0.26 s | 4 | torque-converter-auto |
| bmw-320i-f30-2014 | original | 0 | 184 | 270 | — | 7.21 | 9.98 | 15.36 | 210 km/h | 0.89 s | 5 | torque-converter-auto |
| bmw-320i-f30-2014 | Stage 1 | 2500 | 216 | 317 | 1.20 bar | 6.46 | 9.64 | 14.72 | 225 km/h | 1.07 s | 5 | torque-converter-auto |
| bmw-320i-f30-2014 | preparado | 11900 | 234 | 342 | 1.20 bar | 5.84 | 9.24 | 14.17 | 232 km/h | 0.35 s | 5 | torque-converter-auto |
| honda-civic-si-2008 | original | 0 | 192 | 188 | — | 7.83 | 10.37 | 15.68 | 214 km/h | 0.58 s | 5 | manual |
| honda-civic-si-2008 | remap aspirado | 1800 | 198 | 194 | — | 7.54 | 10.23 | 15.45 | 218 km/h | 0.60 s | 5 | manual |
| honda-civic-si-2008 | aspirado preparado | 13500 | 240 | 218 | — | 6.52 | 9.59 | 14.51 | 235 km/h | 0.95 s | 5 | manual |
| vw-jetta-tsi-2012 | original | 0 | 200 | 280 | — | 7.04 | 10.02 | 15.14 | 221 km/h | 2.45 s | 4 | dual-clutch |
| vw-jetta-tsi-2012 | Stage 1 | 2500 | 235 | 329 | 1.20 bar | 6.63 | 9.83 | 14.71 | 236 km/h | 2.36 s | 4 | dual-clutch |
| vw-jetta-tsi-2012 | preparado | 13550 | 255 | 357 | 1.20 bar | 5.92 | 9.35 | 14.06 | 245 km/h | 1.92 s | 5 | dual-clutch |
| mitsubishi-evo-x-2012 | original | 0 | 295 | 366 | — | 5.32 | 8.89 | 13.66 | 238 km/h | 0.00 s | 5 | dual-clutch |
| mitsubishi-evo-x-2012 | Stage 1 | 2500 | 336 | 416 | 1.55 bar | 4.75 | 8.52 | 13.08 | 253 km/h | 0.02 s | 5 | dual-clutch |
| mitsubishi-evo-x-2012 | preparado | 17100 | 369 | 442 | 1.63 bar | 4.13 | 8.06 | 12.40 | 267 km/h | 0.00 s | 5 | dual-clutch |
| bmw-335i-f30-2013 | original | 0 | 306 | 400 | — | 5.53 | 9.09 | 13.71 | 255 km/h | 1.45 s | 5 | torque-converter-auto |
| bmw-335i-f30-2013 | Stage 1 | 2500 | 352 | 470 | 1.15 bar | 5.23 | 8.89 | 13.31 | 272 km/h | 1.54 s | 6 | torque-converter-auto |
| bmw-335i-f30-2013 | preparado | 19250 | 387 | 534 | 1.23 bar | 4.20 | 8.13 | 12.37 | 282 km/h | 0.37 s | 6 | torque-converter-auto |

## Rivais

- 1. Portas Abertas — Gustavo "Guga": Chevrolet Astra 2.0 Flexpower 2011 (preparado), 146 cv, 195 N·m, 1300 kg, peças [filter-sport, exhaust-sport], RT médio 0.26 s, prêmio 2500 CR
- 2. Turbo Francês — Camila "THP": Peugeot 208 GT 1.6 THP 2017 (preparado), 173 cv, 240 N·m, 1274 kg, peças [tires-sport], RT médio 0.23 s, prêmio 3500 CR
- 3. A Lenda do GTI — Ricardo "GTI": Volkswagen Golf GTI 1.8T 2003 (preparado), 206 cv, 278 N·m, 1340 kg, peças [ecu-stage1, clutch-reinforced], RT médio 0.22 s, prêmio 4500 CR
- 4. Quatro Argolas — André "A3": Audi A3 1.8T 2005 (preparado), 206 cv, 286 N·m, 1365 kg, peças [ecu-stage1, boost-control, clutch-reinforced], RT médio 0.21 s, prêmio 5500 CR
- 5. Precisão Alemã — Helena "C200": Mercedes-Benz C200 W205 2015 (preparado), 215 cv, 349 N·m, 1580 kg, peças [ecu-stage1], RT médio 0.2 s, prêmio 6500 CR
- 6. Tração Traseira — Daniel "320": BMW 320i F30 2014 (preparado), 216 cv, 317 N·m, 1550 kg, peças [ecu-stage1, at-upgrade, suspension-drag-rwd, tires-semislick], RT médio 0.2 s, prêmio 7500 CR
- 7. VTEC — Lucas "Si": Honda Civic Si 2008 (preparado), 240 cv, 218 N·m, 1363 kg, peças [filter-sport, exhaust-sport, manifold-k20-rbc, cam-k20, head-ported, ecu-stage1-na, tires-semislick], RT médio 0.19 s, prêmio 8500 CR
- 8. Troca Perfeita — Felipe "TSI": Volkswagen Jetta Highline TSI 2012 (preparado), 255 cv, 357 N·m, 1456 kg, peças [ecu-stage1, dct-upgrade, intercooler-race, exhaust-sport, tires-semislick], RT médio 0.18 s, prêmio 10000 CR
- 9. Tração Total — Bianca "Evo": Mitsubishi Lancer Evolution X 2012 (preparado), 295 cv, 366 N·m, 1665 kg, peças [awd-center-tune, tires-sport], RT médio 0.17 s, prêmio 13000 CR
- 10. O Dono da Liga — Victor "335": BMW 335i M Sport F30 2013 (preparado), 352 cv, 470 N·m, 1660 kg, peças [ecu-stage1, at-upgrade, tires-semislick, suspension-drag-rwd], RT médio 0.16 s, prêmio 20000 CR

## Corridas contra os rivais (total = RT + ET, s; V = jogador vence)

Sementes: jogador 1000 + i, rival 2000 + i, corrida 3000 + i. Pista e distância do evento.

| carro | build | piloto | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| vw-gol-gts-1988 (cap. 1) | turbo do cap. 1 | intermediate | V 10.77/11.49 | · 10.84/10.81 | · 15.96/15.86 | V 15.81/15.87 | · 15.67/15.31 | · 15.84/14.79 | · 15.89/15.26 | · 15.81/14.67 | · 15.67/14.12 | · 15.77/13.06 |
| vw-gol-gts-1988 (cap. 1) | turbo do cap. 1 | advanced | V 10.49/11.55 | V 10.48/10.92 | V 15.58/15.88 | V 15.48/15.83 | · 15.54/15.25 | · 15.50/14.75 | · 15.54/15.32 | · 15.47/14.71 | · 15.41/14.11 | · 15.42/13.07 |
| vw-saveiro-gl-1994 (prêmio do cap. 1) | Saveiro do Marcos | intermediate | V 11.17/11.58 | · 11.21/10.75 | · 16.71/15.89 | · 16.75/15.83 | · 16.66/15.26 | · 16.67/14.74 | · 16.51/15.23 | · 16.61/14.63 | · 16.59/14.13 | · 16.65/13.05 |
| vw-saveiro-gl-1994 (prêmio do cap. 1) | Saveiro do Marcos | advanced | V 10.90/11.65 | V 10.94/10.95 | · 16.39/15.81 | · 16.35/15.89 | · 16.33/15.30 | · 16.35/14.73 | · 16.34/15.28 | · 16.26/14.66 | · 16.37/14.09 | · 16.33/13.02 |
| gm-astra-2011 | original | intermediate | · 11.59/11.53 | · 11.78/10.93 | · 17.65/15.88 | · 17.45/15.83 | · 17.45/15.30 | · 17.42/14.80 | · 17.53/15.26 | · 17.43/14.64 | · 17.36/14.08 | · 17.50/13.07 |
| gm-astra-2011 | original | advanced | V 11.48/11.58 | · 11.44/10.87 | · 17.19/15.89 | · 17.13/15.86 | · 17.15/15.25 | · 17.18/14.76 | · 17.24/15.34 | · 17.10/14.67 | · 17.13/14.12 | · 17.12/13.09 |
| gm-astra-2011 | remap aspirado | intermediate | · 11.64/11.58 | · 11.59/10.88 | · 17.25/15.86 | · 17.10/15.88 | · 17.33/15.26 | · 17.29/14.75 | · 17.36/15.31 | · 17.12/14.67 | · 17.18/14.11 | · 17.15/13.07 |
| gm-astra-2011 | remap aspirado | advanced | V 11.31/11.58 | · 11.28/10.86 | · 16.98/15.90 | · 16.93/15.88 | · 16.98/15.33 | · 17.03/14.75 | · 16.97/15.32 | · 16.90/14.67 | · 16.93/14.10 | · 16.90/13.08 |
| gm-astra-2011 | aspirado preparado | intermediate | V 11.04/11.55 | · 11.02/10.83 | · 16.32/15.88 | · 16.37/15.84 | · 16.39/15.32 | · 16.47/14.79 | · 16.38/15.28 | · 16.27/14.64 | · 16.46/14.09 | · 16.29/13.03 |
| gm-astra-2011 | aspirado preparado | advanced | V 10.81/11.53 | V 10.77/10.85 | · 16.08/15.93 | · 16.01/15.86 | · 16.06/15.33 | · 16.04/14.74 | · 16.05/15.31 | · 15.98/14.61 | · 16.03/14.05 | · 16.00/13.07 |
| peugeot-208-gt-2017 | original | intermediate | V 11.05/11.58 | · 11.10/10.87 | · 16.47/15.85 | · 16.41/15.85 | · 16.38/15.30 | · 16.39/14.77 | · 16.33/15.32 | · 16.30/14.66 | · 16.19/14.08 | · 16.10/13.04 |
| peugeot-208-gt-2017 | original | advanced | V 10.79/11.63 | V 10.74/10.85 | · 16.04/15.83 | · 16.01/15.84 | · 16.00/15.31 | · 15.99/14.79 | · 16.04/15.28 | · 15.98/14.63 | · 16.03/14.12 | · 15.98/13.05 |
| peugeot-208-gt-2017 | Stage 1 | intermediate | V 10.90/11.56 | · 10.97/10.87 | · 15.98/15.88 | V 15.77/15.88 | · 15.81/15.29 | · 15.89/14.75 | · 15.89/15.28 | · 15.82/14.67 | · 15.86/14.10 | · 15.80/13.05 |
| peugeot-208-gt-2017 | Stage 1 | advanced | V 10.51/11.57 | V 10.54/10.91 | V 15.61/15.88 | V 15.57/15.88 | · 15.56/15.35 | · 15.60/14.74 | · 15.60/15.26 | · 15.52/14.71 | · 15.55/14.12 | · 15.50/13.07 |
| peugeot-208-gt-2017 | preparado | intermediate | V 10.44/11.49 | V 10.42/10.85 | V 15.34/15.85 | V 15.42/15.87 | · 15.37/15.30 | · 15.43/14.77 | · 15.47/15.25 | · 15.37/14.67 | · 15.33/14.13 | · 15.28/13.04 |
| peugeot-208-gt-2017 | preparado | advanced | V 10.17/11.49 | V 10.20/10.83 | V 15.11/15.86 | V 15.15/15.87 | V 15.11/15.24 | · 15.08/14.76 | V 15.15/15.26 | · 15.08/14.65 | · 15.06/14.13 | · 15.03/13.06 |
| vw-golf-gti-mk4-2003 | original | intermediate | V 11.25/11.53 | · 11.16/10.86 | · 16.66/15.89 | · 16.55/15.90 | · 16.69/15.31 | · 16.43/14.76 | · 16.49/15.34 | · 16.41/14.67 | · 16.31/14.09 | · 16.49/13.03 |
| vw-golf-gti-mk4-2003 | original | advanced | V 10.87/11.59 | · 10.92/10.85 | · 16.24/15.84 | · 16.22/15.82 | · 16.24/15.31 | · 16.23/14.76 | · 16.17/15.27 | · 16.14/14.69 | · 16.12/14.09 | · 16.16/13.05 |
| vw-golf-gti-mk4-2003 | Stage 1 | intermediate | V 11.00/11.56 | · 11.04/10.85 | · 16.06/15.88 | · 16.01/15.83 | · 16.02/15.34 | · 15.95/14.80 | · 16.14/15.28 | · 15.98/14.67 | · 15.95/14.06 | · 15.99/13.05 |
| vw-golf-gti-mk4-2003 | Stage 1 | advanced | V 10.62/11.60 | V 10.60/10.88 | V 15.74/15.87 | V 15.74/15.82 | · 15.67/15.33 | · 15.69/14.77 | · 15.72/15.31 | · 15.70/14.64 | · 15.68/14.07 | · 15.67/13.03 |
| vw-golf-gti-mk4-2003 | preparado | intermediate | V 10.41/11.56 | V 10.45/10.83 | V 15.46/15.84 | V 15.38/15.85 | · 15.28/15.26 | · 15.23/14.72 | · 15.38/15.28 | · 15.31/14.65 | · 15.30/14.11 | · 15.27/13.05 |
| vw-golf-gti-mk4-2003 | preparado | advanced | V 10.21/11.59 | V 10.22/10.88 | V 15.09/15.88 | V 15.15/15.87 | V 15.12/15.34 | · 15.11/14.75 | V 15.05/15.30 | · 15.07/14.64 | · 15.03/14.08 | · 15.07/13.03 |
| audi-a3-18t-2005 | original | intermediate | V 11.21/11.54 | · 11.16/10.92 | · 16.74/15.88 | · 16.75/15.90 | · 16.64/15.30 | · 16.65/14.80 | · 16.56/15.32 | · 16.48/14.68 | · 16.48/14.07 | · 16.12/13.04 |
| audi-a3-18t-2005 | original | advanced | V 10.95/11.59 | · 10.95/10.87 | · 16.31/15.84 | · 16.31/15.80 | · 16.32/15.26 | · 16.35/14.74 | · 16.26/15.30 | · 16.24/14.69 | · 16.22/14.09 | · 16.26/13.07 |
| audi-a3-18t-2005 | Stage 1 | intermediate | V 10.94/11.56 | · 10.91/10.85 | · 16.14/15.87 | · 16.14/15.81 | · 16.07/15.30 | · 16.07/14.81 | · 16.00/15.28 | · 15.97/14.69 | · 16.12/14.11 | · 15.97/13.07 |
| audi-a3-18t-2005 | Stage 1 | advanced | V 10.72/11.63 | V 10.69/10.80 | V 15.86/15.88 | V 15.81/15.87 | · 15.77/15.32 | · 15.80/14.75 | · 15.78/15.30 | · 15.72/14.65 | · 15.74/14.09 | · 15.73/13.04 |
| audi-a3-18t-2005 | preparado | intermediate | V 10.60/11.59 | V 10.60/10.83 | V 15.48/15.89 | V 15.51/15.87 | · 15.44/15.27 | · 15.46/14.75 | · 15.35/15.28 | · 15.23/14.64 | · 15.45/14.09 | · 15.33/13.07 |
| audi-a3-18t-2005 | preparado | advanced | V 10.30/11.63 | V 10.28/10.87 | V 15.25/15.85 | V 15.20/15.83 | V 15.19/15.26 | · 15.20/14.77 | V 15.22/15.26 | · 15.17/14.67 | · 15.14/14.11 | · 15.12/13.05 |
| mercedes-c200-w205-2015 | original | intermediate | V 10.90/11.59 | · 10.90/10.88 | · 16.12/15.85 | · 16.30/15.84 | · 16.15/15.28 | · 16.21/14.80 | · 16.07/15.24 | · 16.10/14.65 | · 16.24/14.08 | · 16.21/13.06 |
| mercedes-c200-w205-2015 | original | advanced | V 10.51/11.54 | V 10.56/10.85 | V 15.89/15.91 | · 15.88/15.87 | · 15.88/15.33 | · 15.85/14.72 | · 15.84/15.24 | · 15.75/14.64 | · 15.78/14.10 | · 15.81/13.05 |
| mercedes-c200-w205-2015 | Stage 1 | intermediate | V 10.23/11.54 | V 10.29/10.79 | V 15.35/15.83 | V 15.26/15.85 | · 15.29/15.28 | · 15.28/14.71 | V 15.19/15.30 | · 15.15/14.65 | · 15.13/14.12 | · 15.24/13.08 |
| mercedes-c200-w205-2015 | Stage 1 | advanced | V 10.19/11.58 | V 10.16/10.85 | V 15.30/15.89 | V 15.29/15.84 | V 15.22/15.24 | · 15.27/14.80 | · 15.31/15.30 | · 15.13/14.67 | · 15.19/14.09 | · 15.15/13.05 |
| mercedes-c200-w205-2015 | preparado | intermediate | V 10.18/11.50 | V 9.75/10.83 | V 15.14/15.87 | V 14.97/15.84 | V 15.03/15.27 | · 14.86/14.78 | V 14.84/15.27 | · 14.91/14.68 | · 14.82/14.10 | · 14.86/13.05 |
| mercedes-c200-w205-2015 | preparado | advanced | V 9.76/11.55 | V 9.80/10.82 | V 14.73/15.84 | V 14.67/15.85 | V 14.69/15.24 | V 14.74/14.75 | V 14.68/15.30 | V 14.67/14.70 | · 14.60/14.06 | · 14.63/13.06 |
| bmw-320i-f30-2014 | original | intermediate | V 10.61/11.56 | V 10.43/10.85 | · 15.96/15.85 | · 15.86/15.84 | · 15.89/15.28 | · 15.79/14.79 | · 15.83/15.30 | · 15.75/14.68 | · 15.80/14.09 | · 15.81/13.05 |
| bmw-320i-f30-2014 | original | advanced | V 10.39/11.60 | V 10.44/10.91 | V 15.80/15.84 | V 15.77/15.86 | · 15.71/15.27 | · 15.77/14.75 | · 15.72/15.29 | · 15.74/14.66 | · 15.68/14.09 | · 15.68/13.03 |
| bmw-320i-f30-2014 | Stage 1 | intermediate | V 10.00/11.64 | V 9.93/10.82 | V 15.11/15.86 | V 15.06/15.86 | V 15.15/15.31 | · 15.10/14.81 | V 15.04/15.30 | V 14.60/14.65 | · 14.94/14.09 | · 14.89/13.04 |
| bmw-320i-f30-2014 | Stage 1 | advanced | V 9.98/11.62 | V 9.97/10.85 | V 15.09/15.82 | V 15.07/15.79 | V 15.03/15.32 | · 14.98/14.78 | V 15.00/15.30 | · 14.96/14.67 | · 14.90/14.10 | · 14.91/13.05 |
| bmw-320i-f30-2014 | preparado | intermediate | V 9.57/11.64 | V 9.48/10.89 | V 14.42/15.91 | V 14.43/15.88 | V 14.42/15.27 | V 14.43/14.79 | V 14.44/15.31 | V 14.47/14.65 | · 14.43/14.08 | · 14.44/13.05 |
| bmw-320i-f30-2014 | preparado | advanced | V 9.42/11.48 | V 9.48/10.78 | V 14.44/15.87 | V 14.39/15.84 | V 14.40/15.27 | V 14.35/14.73 | V 14.37/15.31 | V 14.31/14.69 | · 14.35/14.10 | · 14.35/13.06 |
| honda-civic-si-2008 | original | intermediate | V 11.08/11.59 | · 11.26/10.86 | · 16.57/15.86 | · 16.62/15.85 | · 16.59/15.32 | · 16.60/14.73 | · 16.60/15.30 | · 16.35/14.64 | · 16.56/14.10 | · 16.36/13.05 |
| honda-civic-si-2008 | original | advanced | V 10.91/11.59 | · 10.93/10.82 | · 16.25/15.79 | · 16.17/15.84 | · 16.14/15.35 | · 16.24/14.79 | · 16.22/15.28 | · 16.19/14.67 | · 16.18/14.10 | · 16.15/13.06 |
| honda-civic-si-2008 | remap aspirado | intermediate | V 11.20/11.57 | · 11.09/10.89 | · 16.23/15.88 | · 16.32/15.85 | · 16.24/15.31 | · 16.25/14.74 | · 16.18/15.33 | · 16.39/14.66 | · 16.26/14.10 | · 16.17/13.04 |
| honda-civic-si-2008 | remap aspirado | advanced | V 10.80/11.60 | V 10.80/10.82 | · 16.05/15.81 | · 15.93/15.87 | · 15.99/15.33 | · 15.99/14.76 | · 15.97/15.27 | · 15.93/14.64 | · 15.91/14.11 | · 15.95/13.04 |
| honda-civic-si-2008 | aspirado preparado | intermediate | V 10.50/11.56 | V 10.75/10.79 | V 15.68/15.86 | V 15.61/15.84 | · 15.70/15.32 | · 15.52/14.76 | · 15.66/15.34 | · 15.53/14.66 | · 15.41/14.10 | · 15.48/13.06 |
| honda-civic-si-2008 | aspirado preparado | advanced | V 10.37/11.52 | V 10.38/10.95 | V 15.30/15.89 | V 15.33/15.89 | · 15.29/15.27 | · 15.24/14.76 | · 15.32/15.27 | · 15.17/14.64 | · 15.19/14.10 | · 15.23/13.07 |
| vw-jetta-tsi-2012 | original | intermediate | V 10.87/11.60 | V 10.79/10.87 | · 15.96/15.87 | · 15.89/15.87 | · 15.95/15.32 | · 15.87/14.76 | · 15.88/15.29 | · 15.75/14.69 | · 15.92/14.12 | · 15.78/13.06 |
| vw-jetta-tsi-2012 | original | advanced | V 10.59/11.54 | V 10.59/10.80 | V 15.76/15.88 | V 15.72/15.85 | · 15.75/15.29 | · 15.71/14.77 | · 15.77/15.28 | · 15.63/14.65 | · 15.67/14.14 | · 15.59/13.04 |
| vw-jetta-tsi-2012 | Stage 1 | intermediate | V 10.61/11.54 | V 10.68/10.87 | V 15.53/15.89 | V 15.61/15.89 | · 15.53/15.24 | · 15.42/14.76 | · 15.53/15.30 | · 15.43/14.64 | · 15.41/14.10 | · 15.38/13.08 |
| vw-jetta-tsi-2012 | Stage 1 | advanced | V 10.42/11.58 | V 10.40/10.83 | V 15.32/15.89 | V 15.30/15.88 | V 15.30/15.35 | · 15.31/14.77 | V 15.27/15.35 | · 15.25/14.65 | · 15.17/14.12 | · 15.25/13.06 |
| vw-jetta-tsi-2012 | preparado | intermediate | V 10.08/11.68 | V 10.12/10.85 | V 14.90/15.88 | V 14.90/15.90 | V 14.84/15.33 | · 14.92/14.73 | V 14.87/15.27 | · 14.76/14.66 | · 14.70/14.12 | · 14.77/13.07 |
| vw-jetta-tsi-2012 | preparado | advanced | V 9.95/11.58 | V 9.99/10.92 | V 14.74/15.87 | V 14.70/15.85 | V 14.76/15.28 | V 14.70/14.78 | V 14.72/15.28 | V 14.60/14.68 | · 14.64/14.07 | · 14.57/13.06 |
| mitsubishi-evo-x-2012 | original | intermediate | V 9.50/11.60 | V 9.41/10.80 | V 14.31/15.90 | V 14.25/15.90 | V 14.17/15.25 | V 14.30/14.79 | V 14.38/15.25 | V 14.24/14.63 | · 14.27/14.12 | · 14.27/13.06 |
| mitsubishi-evo-x-2012 | original | advanced | V 9.33/11.59 | V 9.40/10.83 | V 14.23/15.82 | V 14.18/15.88 | V 14.23/15.30 | V 14.20/14.76 | V 14.22/15.29 | V 14.15/14.63 | · 14.15/14.08 | · 14.20/13.06 |
| mitsubishi-evo-x-2012 | Stage 1 | intermediate | V 9.15/11.60 | V 9.11/10.81 | V 13.70/15.86 | V 13.72/15.86 | V 13.59/15.27 | V 13.78/14.77 | V 13.78/15.28 | V 13.65/14.63 | V 13.62/14.08 | · 13.75/13.05 |
| mitsubishi-evo-x-2012 | Stage 1 | advanced | V 8.99/11.55 | V 9.06/10.83 | V 13.60/15.85 | V 13.62/15.89 | V 13.62/15.31 | V 13.61/14.78 | V 13.54/15.29 | V 13.59/14.66 | V 13.61/14.11 | · 13.60/13.02 |
| mitsubishi-evo-x-2012 | preparado | intermediate | V 8.66/11.60 | V 8.71/10.95 | V 12.99/15.85 | V 12.98/15.87 | V 13.01/15.26 | V 12.91/14.78 | V 12.95/15.27 | V 12.92/14.66 | V 13.06/14.09 | V 13.00/13.07 |
| mitsubishi-evo-x-2012 | preparado | advanced | V 8.49/11.57 | V 8.50/10.91 | V 12.91/15.91 | V 12.88/15.85 | V 12.88/15.30 | V 12.91/14.78 | V 12.91/15.30 | V 12.87/14.65 | V 12.83/14.08 | V 12.88/13.07 |
| bmw-335i-f30-2013 | original | intermediate | V 9.71/11.64 | V 9.70/10.82 | V 14.36/15.86 | V 14.36/15.89 | V 14.35/15.28 | V 14.17/14.74 | V 14.19/15.30 | V 14.06/14.67 | V 13.77/14.06 | · 14.30/13.05 |
| bmw-335i-f30-2013 | original | advanced | V 9.59/11.60 | V 9.61/10.87 | V 14.26/15.86 | V 14.24/15.90 | V 14.17/15.31 | V 14.17/14.76 | V 14.18/15.29 | V 14.11/14.66 | · 14.10/14.09 | · 14.11/13.05 |
| bmw-335i-f30-2013 | Stage 1 | intermediate | V 9.53/11.48 | V 9.04/10.79 | V 13.85/15.90 | V 13.92/15.86 | V 13.57/15.30 | V 13.57/14.80 | V 13.90/15.31 | V 13.63/14.64 | V 13.71/14.09 | · 13.77/13.06 |
| bmw-335i-f30-2013 | Stage 1 | advanced | V 9.42/11.53 | V 9.37/10.85 | V 13.86/15.89 | V 13.78/15.89 | V 13.76/15.33 | V 13.79/14.79 | V 13.81/15.27 | V 13.73/14.63 | V 13.69/14.10 | · 13.70/13.07 |
| bmw-335i-f30-2013 | preparado | intermediate | V 8.57/11.55 | V 8.49/10.86 | V 12.76/15.88 | V 12.79/15.84 | V 12.75/15.23 | V 12.82/14.74 | V 12.77/15.28 | V 12.76/14.68 | V 12.63/14.06 | V 12.72/13.04 |
| bmw-335i-f30-2013 | preparado | advanced | V 8.46/11.63 | V 8.44/10.87 | V 12.73/15.92 | V 12.69/15.82 | V 12.73/15.32 | V 12.70/14.74 | V 12.70/15.29 | V 12.60/14.68 | V 12.60/14.14 | V 12.59/13.04 |

## Campanha simulada (início: capítulo 1 concluído, Gol turbo, 4.000 CR, 200 de reputação; limite de 160 corridas; compra só com 3.000 CR de reserva para peças; repete o evento mais bem pago que o carro atual venceu por último)

| estratégia | piloto | corridas | derrotas | repetições pagas | carros comprados | CR gastos em peças | créditos finais | concluiu | parou em |
|---|---|---:|---:|---:|---|---:|---:|---|---|
| fica com o carro do cap. 1 e compra quando trava | intermediate | 72 | 32 | 30 | vw-golf-gti-mk4-2003, bmw-320i-f30-2014, mitsubishi-evo-x-2012 | 47900 | 20140 | sim | — |
| fica com o carro do cap. 1 e compra quando trava | advanced | 50 | 20 | 20 | vw-golf-gti-mk4-2003, bmw-320i-f30-2014, mitsubishi-evo-x-2012 | 42900 | 20050 | sim | — |
| compra o 208 cedo | intermediate | 96 | 43 | 43 | peugeot-208-gt-2017, mercedes-c200-w205-2015, mitsubishi-evo-x-2012 | 57300 | 20400 | sim | — |
| compra o 208 cedo | advanced | 48 | 19 | 19 | peugeot-208-gt-2017, mercedes-c200-w205-2015, mitsubishi-evo-x-2012 | 42900 | 20380 | sim | — |
| começa pela Astra, passa pelo Golf e pelo Civic | intermediate | 160 | 78 | 78 | gm-astra-2011, vw-golf-gti-mk4-2003, honda-civic-si-2008 | 30900 | 36260 | não | 5. Precisão Alemã (honda-civic-si-2008, 8 peças) |
| começa pela Astra, passa pelo Golf e pelo Civic | advanced | 160 | 78 | 77 | gm-astra-2011, vw-golf-gti-mk4-2003, honda-civic-si-2008 | 30900 | 40560 | não | 6. Tração Traseira (honda-civic-si-2008, 8 peças) |
