# Matriz de cobertura — perfis de turbo por veículo

> Gerado por `npx tsx scripts/audio-turbo-report.ts`. Um build de referência por carro: turbo de fábrica
> (stock), preset turbo do Sandbox, kit clássico médio ou conversão estágio 2 da oficina. Cada linha mostra o
> perfil base resolvido e a cadeia de modificadores aplicada pelo `TurboProfileResolver`.

| Build | Grupo | Rotores | Carcaça | Válvula | Wastegate | Admissão | Perfil base | Cadeia |
|---|---|---|---|---|---|---|---|---|
| vetra-rs/stock | lab | 1 | single-scroll | atmosphere | internal | airbox | modern-performance-oem | turbo de fábrica Vetra 2.0 Turbo → base modern-performance-oem |
| orion-xr/stock | lab | 1 | single-scroll | atmosphere | internal | airbox | modern-big-turbo | turbo de fábrica Orion 3.0 I6 Turbo → base modern-big-turbo → família orion-i6 |
| vw-gol-gts-1988/preset:vw-gol-ap-turbo-sandbox | sandbox-preset | 1 | single-scroll | atmosphere | internal | airbox | classic-small-turbo | kit basic (VW AP 1.8) → base classic-small-turbo → família vw-ap |
| fiat-uno-mille-1995/turbo-medium | classic | 1 | single-scroll | atmosphere | internal | airbox | classic-medium-turbo | kit medium (Fiat Fiasa 1.0) → base classic-medium-turbo → família fiat-fiasa |
| gm-chevette-sl-1988/turbo-medium | classic | 1 | single-scroll | atmosphere | internal | airbox | classic-medium-turbo | kit medium (GM Chevette 1.6/S) → base classic-medium-turbo → família gm-chevette |
| gm-celta-2003/turbo-medium | classic | 1 | single-scroll | atmosphere | internal | airbox | classic-medium-turbo | kit medium (GM Família I VHC 1.0) → base classic-medium-turbo → família gm-familia1-vhc |
| gm-corsa-gl-1996/turbo-medium | classic | 1 | single-scroll | atmosphere | internal | airbox | classic-medium-turbo | kit medium (GM Família I 1.4) → base classic-medium-turbo → família gm-familia1-efi |
| gm-kadett-sl-1992/turbo-medium | classic | 1 | single-scroll | atmosphere | internal | airbox | classic-medium-turbo | kit medium (GM Família II 1.8) → base classic-medium-turbo → família gm-familia2-18 |
| vw-saveiro-gl-1994/preset:vw-saveiro-marcos-turbo-sandbox | sandbox-preset | 1 | single-scroll | atmosphere | internal | airbox | classic-small-turbo | kit basic (VW AP 1.8) → base classic-small-turbo → família vw-ap |
| gm-astra-2011/conversion-s2 | conversion | 1 | single-scroll | atmosphere | internal | airbox | modern-na-conversion | conversão (GM Família II 2.0 Flex) → base modern-na-conversion |
| peugeot-208-gt-2017/stock | factory | 1 | single-scroll | recirculating | internal | airbox | modern-small-oem | turbo de fábrica PSA/BMW Prince THP 1.6 → base modern-small-oem → família psa-prince-thp → válvula recirculante |
| vw-golf-gti-mk4-2003/stock | factory | 1 | single-scroll | recirculating | internal | airbox | modern-medium-oem | turbo de fábrica VW EA113 1.8T → base modern-medium-oem → válvula recirculante |
| audi-a3-18t-2005/stock | factory | 1 | single-scroll | recirculating | internal | airbox | modern-medium-oem | turbo de fábrica VW EA113 1.8T → base modern-medium-oem → válvula recirculante |
| mercedes-c200-w205-2015/stock | factory | 1 | single-scroll | recirculating | internal | airbox | modern-small-oem | turbo de fábrica Mercedes M274 → base modern-small-oem → família mb-m274 → válvula recirculante |
| bmw-320i-f30-2014/stock | factory | 1 | twin-scroll | recirculating | internal | airbox | modern-twin-scroll | turbo de fábrica BMW N20 (twin-scroll) → base modern-twin-scroll → família bmw-n20 → válvula recirculante → twin-scroll (1 rotor) |
| honda-civic-si-2008/conversion-s2 | conversion | 1 | single-scroll | atmosphere | internal | airbox | modern-na-conversion | conversão (Honda K20Z3) → base modern-na-conversion → família honda-k20 |
| vw-jetta-tsi-2012/stock | factory | 1 | single-scroll | recirculating | internal | airbox | modern-medium-oem | turbo de fábrica VW EA888 2.0 TSI → base modern-medium-oem → família vw-ea888 → válvula recirculante |
| mitsubishi-evo-x-2012/stock | factory | 1 | single-scroll | recirculating | internal | airbox | modern-performance-oem | turbo de fábrica Mitsubishi 4B11T → base modern-performance-oem → válvula recirculante |
| bmw-335i-f30-2013/stock | factory | 1 | twin-scroll | recirculating | internal | airbox | modern-twin-scroll | turbo de fábrica BMW N55 (twin-scroll I6) → base modern-twin-scroll → família bmw-n55 → válvula recirculante → twin-scroll (1 rotor) |
| nissan-350z-2006/conversion-s2 | conversion | 1 | single-scroll | atmosphere | internal | airbox | v6-single-conversion | conversão (Nissan VQ35DE) → base v6-single-conversion |
| nissan-370z-2014/conversion-s2 | conversion | 1 | single-scroll | atmosphere | internal | airbox | v6-single-conversion | conversão (Nissan VQ37VHR) → base v6-single-conversion → família nissan-vq37vhr |
| mercedes-amg-c43-2017/stock | twin | 2 | single-scroll | recirculating | internal | airbox | v6-parallel-twin-oem | turbo de fábrica Mercedes M276 biturbo → base v6-parallel-twin-oem → família mercedes-m276 → válvula recirculante → biturbo paralelo (2 rotores) |
| kia-stinger-gt-2019/stock | twin | 2 | single-scroll | recirculating | internal | airbox | v6-parallel-twin-oem | turbo de fábrica Kia Lambda II 3.3 T-GDi → base v6-parallel-twin-oem → família kia-lambda33 → válvula recirculante → biturbo paralelo (2 rotores) |
| maserati-ghibli-sq4-2015/stock | twin | 2 | single-scroll | recirculating | internal | airbox | v6-parallel-twin-oem | turbo de fábrica Maserati F160 → base v6-parallel-twin-oem → família maserati-f160 → válvula recirculante → biturbo paralelo (2 rotores) |
| alfa-giulia-qv-2017/stock | twin | 2 | single-scroll | recirculating | internal | airbox | v6-parallel-twin-oem | turbo de fábrica Alfa Romeo 690T → base v6-parallel-twin-oem → família alfa-690t → válvula recirculante → biturbo paralelo (2 rotores) |
| nissan-gtr-r35-2015/stock | twin | 2 | single-scroll | recirculating | internal | airbox | v6-parallel-twin-oem | turbo de fábrica Nissan VR38DETT → base v6-parallel-twin-oem → família nissan-vr38dett → válvula recirculante → biturbo paralelo (2 rotores) |
