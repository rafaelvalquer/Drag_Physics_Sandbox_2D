# Matriz de calibração — nível e custo

> Gerado por `npx tsx scripts/audio-turbo-report.ts`. Nível ponderado A (dBA relativos, canal turbo
> isolado antes do mixer). O ganho global `TURBO_V2_OUTPUT` alinha o 2.0 ao legado em carga plena nos kits
> e conversões (± 1 dB), para a comparação A/B no Sandbox não favorecer o modelo mais alto. Turbos de fábrica
> (caixa de ar, válvula recirculada) ficam de propósito 4–7 dB abaixo: o legado não fazia essa distinção.
> Custo = ms de CPU por segundo de áudio da voz completa (7 canais, 48 kHz, melhor de 7 intercalado; Node, uma thread).

| Build | Grupo | Layout | Válvula | Boost máx (bar) | Rotor máx (rpm) | dBA run antes → depois | Δ dBA | dBA tip-out antes → depois | Custo antes → depois (ms/s) | Δ custo |
|---|---|---|---|---|---|---|---|---|---|---|
| vw-gol-gts-1988/preset:vw-gol-ap-turbo-sandbox | sandbox-preset | single | atmosphere | 0.50 | 149098 | -34.5 → -33.5 | +1.0 | -32.9 → -37.7 | 70.1 → 81.3 | 16% |
| vw-saveiro-gl-1994/preset:vw-saveiro-marcos-turbo-sandbox | sandbox-preset | single | atmosphere | 0.60 | 149097 | -33.3 → -33.5 | -0.2 | -32.0 → -36.5 | 69.8 → 80.7 | 16% |
| bmw-320i-f30-2014/stock | factory | single | recirculating | 0.90 | 192953 | -34.7 → -41.3 | -6.6 | -48.3 → -51.6 | 73.1 → 83.2 | 14% |
| honda-civic-si-2008/conversion-s2 | conversion | single | atmosphere | 0.45 | 143814 | -34.1 → -33.3 | +0.9 | -32.9 → -37.9 | 76.4 → 88.6 | 16% |
| mitsubishi-evo-x-2012/stock | factory | single | recirculating | 1.25 | 166641 | -30.7 → -35.3 | -4.5 | -43.1 → -47.3 | 72.1 → 81.8 | 14% |
| nissan-370z-2014/conversion-s2 | conversion | single | atmosphere | 0.42 | 143827 | -34.2 → -33.1 | +1.1 | -33.1 → -38.0 | 92.1 → 103.6 | 12% |
| nissan-gtr-r35-2015/stock | twin | parallel-twin | recirculating | 1.00 | 192953 | -32.3 → -37.6 | -5.3 | -44.6 → -49.0 | 87.3 → 97.6 | 12% |

**Média:** Δ nível -1.9 dBA; custo 77.3 → 88.1 ms/s (14%; meta < 15%).
