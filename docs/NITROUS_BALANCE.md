# Balanceamento do nitro contínuo

Executado com `npx tsx scripts/nitrous-balance.ts` usando a pista de testes, piloto avançado, passo fixo de 120 Hz e limites mecânicos da campanha. Cada kit é comparado desligado, em uso contínuo e em uso estratégico nas quatro vazões. O carro, a pista, o piloto e a capacidade do kit permanecem iguais dentro de cada comparação.

Foram medidos 11 carros e 352 ensaios com solicitação de nitro, com 0 quebras. As três primeiras colunas numéricas são tempos em segundos para 201,168 m, 402,336 m e 1.000 m. As velocidades correspondem à passagem por cada distância. Massa, tempo ativo, picos de potência e torque do nitro e patinagem são acumulados até 1.000 m ou até o fim do ensaio.

```text
== Capítulo 1: Fiat Uno Mille Electronic 1.0 1995 (fiat-uno-mille-1995) — 201 m / 402 m / 1000 m (s)
sem kit                        12.60  19.69  36.75
nitrous-street desligado       12.63  19.72  36.82 · km/h  90.93 / 110.94 / 136.82 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.26 s · sem quebra
nitrous-street 25% continuous  12.19  18.87  34.91 · km/h  97.08 / 118.34 / 144.03 · 20.0 g / 30.64 s · +11.2 cv / +20.6 N·m · patinação 0.47 s · sem quebra
nitrous-street 25% strategic   12.23  18.92  34.97 · km/h  96.77 / 118.18 / 145.08 · 19.9 g / 30.24 s · +11.2 cv / +18.7 N·m · patinação 0.26 s · sem quebra
nitrous-street 50% continuous  11.74  18.09  34.10 · km/h 102.56 / 124.91 / 140.42 · 20.0 g / 15.62 s · +22.5 cv / +38.8 N·m · patinação 0.47 s · sem quebra
nitrous-street 50% strategic   11.91  18.29  34.17 · km/h 101.88 / 124.77 / 141.16 · 20.0 g / 15.32 s · +22.5 cv / +36.8 N·m · patinação 0.26 s · sem quebra
nitrous-street 75% continuous  11.40  17.66  33.86 · km/h 105.42 / 122.23 / 139.51 · 20.0 g / 10.66 s · +33.7 cv / +58.7 N·m · patinação 1.37 s · sem quebra
nitrous-street 75% strategic   11.64  17.84  33.89 · km/h 105.60 / 124.46 / 140.26 · 20.0 g / 10.36 s · +33.7 cv / +54.3 N·m · patinação 0.26 s · sem quebra
nitrous-street 100% continuous 11.20  17.55  33.88 · km/h 106.98 / 120.47 / 139.79 · 20.0 g / 8.03 s · +45.0 cv / +76.7 N·m · patinação 1.24 s · sem quebra
nitrous-street 100% strategic  11.44  17.62  33.76 · km/h 107.96 / 123.09 / 139.80 · 20.0 g / 7.88 s · +45.0 cv / +71.3 N·m · patinação 0.26 s · sem quebra
nitrous-wet desligado          12.64  19.74  36.85 · km/h  90.84 / 110.85 / 136.74 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.25 s · sem quebra
nitrous-wet 25% continuous     11.83  18.27  33.68 · km/h 101.11 / 123.30 / 150.91 · 40.0 g / 30.64 s · +19.5 cv / +35.6 N·m · patinação 0.46 s · sem quebra
nitrous-wet 25% strategic      12.00  18.46  33.90 · km/h 100.48 / 122.97 / 151.34 · 38.4 g / 29.17 s · +19.5 cv / +32.0 N·m · patinação 0.25 s · sem quebra
nitrous-wet 50% continuous     11.28  17.25  32.58 · km/h 106.98 / 133.76 / 144.29 · 40.0 g / 15.62 s · +39.0 cv / +69.1 N·m · patinação 1.39 s · sem quebra
nitrous-wet 50% strategic      11.55  17.56  32.71 · km/h 106.01 / 133.19 / 145.83 · 40.0 g / 15.47 s · +39.0 cv / +62.4 N·m · patinação 0.25 s · sem quebra
nitrous-wet 75% continuous     11.10  16.98  32.74 · km/h 111.61 / 128.77 / 141.74 · 40.0 g / 10.65 s · +58.5 cv / +95.7 N·m · patinação 1.20 s · sem quebra
nitrous-wet 75% strategic      11.32  17.12  32.62 · km/h 110.52 / 132.72 / 143.23 · 40.0 g / 10.36 s · +58.5 cv / +89.5 N·m · patinação 0.25 s · sem quebra
nitrous-wet 100% continuous    12.21  19.10  36.40 · km/h  96.33 / 111.83 / 134.41 · 40.0 g / 9.07 s · +78.0 cv / +117.8 N·m · patinação 1.30 s · sem quebra
nitrous-wet 100% strategic     12.19  18.90  35.90 · km/h  96.77 / 114.89 / 135.69 · 40.0 g / 8.78 s · +78.0 cv / +117.8 N·m · patinação 0.25 s · sem quebra
nitrous-progressive desligado  12.66  19.76  36.88 · km/h  90.75 / 110.75 / 136.65 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.25 s · sem quebra
nitrous-progressive 25% continuous 11.50  17.71  32.54 · km/h 105.11 / 128.36 / 157.84 · 69.8 g / 30.06 s · +28.6 cv / +52.9 N·m · patinação 1.37 s · sem quebra
nitrous-progressive 25% strategic 11.78  18.02  32.88 · km/h 104.21 / 127.87 / 157.69 · 65.9 g / 28.15 s · +28.6 cv / +46.5 N·m · patinação 0.25 s · sem quebra
nitrous-progressive 50% continuous 11.09  16.81  31.32 · km/h 111.24 / 138.09 / 150.35 · 75.0 g / 16.72 s · +57.3 cv / +92.1 N·m · patinação 1.32 s · sem quebra
nitrous-progressive 50% strategic 11.34  17.09  31.45 · km/h 110.26 / 137.91 / 152.04 · 75.0 g / 16.27 s · +57.3 cv / +88.0 N·m · patinação 0.25 s · sem quebra
nitrous-progressive 75% continuous 12.52  19.12  35.56 · km/h  94.55 / 121.41 / 138.41 · 75.0 g / 13.59 s · +85.9 cv / +125.5 N·m · patinação 1.37 s · sem quebra
nitrous-progressive 75% strategic 12.41  18.96  35.00 · km/h  95.27 / 124.85 / 140.46 · 75.0 g / 13.30 s · +85.9 cv / +125.5 N·m · patinação 0.25 s · sem quebra
nitrous-progressive 100% continuous 12.91  19.62  36.35 · km/h  92.98 / 117.98 / 136.94 · 75.0 g / 12.39 s · +114.5 cv / +150.2 N·m · patinação 1.21 s · sem quebra
nitrous-progressive 100% strategic 12.65  19.27  35.52 · km/h  93.88 / 123.52 / 139.32 · 75.0 g / 12.18 s · +114.5 cv / +150.2 N·m · patinação 0.25 s · sem quebra
nitrous-direct desligado       12.68  19.79  36.93 · km/h  90.62 / 110.63 / 136.54 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.25 s · sem quebra
nitrous-direct 25% continuous  11.31  17.31  31.65 · km/h 106.37 / 132.90 / 163.57 · 105.6 g / 29.15 s · +37.7 cv / +67.4 N·m · patinação 1.46 s · sem quebra
nitrous-direct 25% strategic   11.60  17.65  32.02 · km/h 105.54 / 132.31 / 163.39 · 99.7 g / 27.27 s · +37.7 cv / +60.6 N·m · patinação 0.25 s · sem quebra
nitrous-direct 50% continuous  12.14  18.63  34.47 · km/h  96.59 / 125.86 / 141.58 · 115.0 g / 16.43 s · +75.5 cv / +115.3 N·m · patinação 1.37 s · sem quebra
nitrous-direct 50% strategic   12.11  18.56  34.06 · km/h  97.37 / 126.36 / 143.80 · 115.0 g / 15.98 s · +75.5 cv / +115.3 N·m · patinação 0.25 s · sem quebra
nitrous-direct 75% continuous  12.91  19.58  35.41 · km/h  92.85 / 123.32 / 141.84 · 115.0 g / 16.10 s · +113.2 cv / +149.5 N·m · patinação 1.23 s · sem quebra
nitrous-direct 75% strategic   12.67  19.29  34.77 · km/h  93.74 / 123.84 / 144.56 · 115.0 g / 15.95 s · +113.2 cv / +149.5 N·m · patinação 0.25 s · sem quebra
nitrous-direct 100% continuous 13.12  19.83  35.89 · km/h  92.15 / 122.97 / 140.35 · 115.0 g / 14.58 s · +150.9 cv / +179.6 N·m · patinação 1.23 s · sem quebra
nitrous-direct 100% strategic  12.78  19.43  35.06 · km/h  93.19 / 123.59 / 143.30 · 115.0 g / 14.44 s · +150.9 cv / +178.8 N·m · patinação 0.25 s · sem quebra

== Capítulo 1: Chevrolet Chevette SL 1.6/S 1988 (gm-chevette-sl-1988) — 201 m / 402 m / 1000 m (s)
sem kit                        12.28  19.08  35.60
nitrous-street desligado       12.30  19.11  35.65 · km/h  94.61 / 116.11 / 140.93 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.55 s · sem quebra
nitrous-street 25% continuous  11.86  18.36  34.05 · km/h  99.52 / 121.03 / 148.11 · 20.0 g / 30.43 s · +11.2 cv / +20.3 N·m · patinação 0.56 s · sem quebra
nitrous-street 25% strategic   12.00  18.51  34.22 · km/h  99.18 / 120.86 / 148.65 · 19.8 g / 29.85 s · +11.2 cv / +19.9 N·m · patinação 0.55 s · sem quebra
nitrous-street 50% continuous  11.50  17.74  33.42 · km/h 103.99 / 126.46 / 144.87 · 20.0 g / 15.55 s · +22.5 cv / +39.8 N·m · patinação 0.56 s · sem quebra
nitrous-street 50% strategic   11.75  18.01  33.60 · km/h 103.35 / 126.13 / 145.42 · 20.0 g / 15.32 s · +22.5 cv / +39.4 N·m · patinação 0.55 s · sem quebra
nitrous-street 75% continuous  11.21  17.35  33.21 · km/h 108.07 / 124.45 / 143.99 · 20.0 g / 10.44 s · +33.7 cv / +59.4 N·m · patinação 0.56 s · sem quebra
nitrous-street 75% strategic   11.54  17.65  33.40 · km/h 107.19 / 125.98 / 144.53 · 20.0 g / 10.36 s · +33.7 cv / +58.4 N·m · patinação 0.55 s · sem quebra
nitrous-street 100% continuous 10.96  17.16  33.09 · km/h 109.59 / 123.36 / 143.61 · 20.0 g / 7.96 s · +45.0 cv / +78.9 N·m · patinação 0.84 s · sem quebra
nitrous-street 100% strategic  11.35  17.46  33.29 · km/h 110.73 / 124.78 / 144.11 · 20.0 g / 7.73 s · +45.0 cv / +77.4 N·m · patinação 0.55 s · sem quebra
nitrous-wet desligado          12.30  19.12  35.67 · km/h  94.53 / 116.02 / 140.85 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.55 s · sem quebra
nitrous-wet 25% continuous     11.59  17.89  33.07 · km/h 102.78 / 124.97 / 153.56 · 40.0 g / 30.44 s · +19.5 cv / +36.3 N·m · patinação 0.56 s · sem quebra
nitrous-wet 25% strategic      11.82  18.15  33.35 · km/h 102.19 / 124.67 / 153.66 · 38.4 g / 28.98 s · +19.5 cv / +34.3 N·m · patinação 0.55 s · sem quebra
nitrous-wet 50% continuous     11.07  17.00  32.07 · km/h 109.81 / 133.64 / 148.14 · 40.0 g / 15.57 s · +39.0 cv / +68.8 N·m · patinação 0.77 s · sem quebra
nitrous-wet 50% strategic      11.45  17.42  32.35 · km/h 108.79 / 133.11 / 149.08 · 40.0 g / 15.32 s · +39.0 cv / +67.2 N·m · patinação 0.55 s · sem quebra
nitrous-wet 75% continuous     10.72  16.49  31.83 · km/h 115.26 / 131.83 / 146.62 · 40.0 g / 10.60 s · +58.5 cv / +105.5 N·m · patinação 1.17 s · sem quebra
nitrous-wet 75% strategic      11.17  16.90  32.06 · km/h 114.44 / 134.38 / 147.58 · 40.0 g / 10.36 s · +58.5 cv / +99.7 N·m · patinação 0.55 s · sem quebra
nitrous-wet 100% continuous    10.62  16.52  32.11 · km/h 116.57 / 128.22 / 145.29 · 40.0 g / 8.12 s · +78.0 cv / +130.8 N·m · patinação 0.97 s · sem quebra
nitrous-wet 100% strategic     11.02  16.81  32.22 · km/h 115.35 / 130.69 / 146.20 · 40.0 g / 7.88 s · +78.0 cv / +127.1 N·m · patinação 0.55 s · sem quebra
nitrous-progressive desligado  12.31  19.14  35.69 · km/h  94.45 / 115.94 / 140.77 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.55 s · sem quebra
nitrous-progressive 25% continuous 11.31  17.43  32.14 · km/h 106.15 / 129.09 / 157.45 · 68.4 g / 29.47 s · +28.6 cv / +54.4 N·m · patinação 0.50 s · sem quebra
nitrous-progressive 25% strategic 11.65  17.80  32.52 · km/h 105.31 / 128.65 / 157.31 · 65.0 g / 27.78 s · +28.6 cv / +49.9 N·m · patinação 0.55 s · sem quebra
nitrous-progressive 50% continuous 10.74  16.40  30.72 · km/h 115.38 / 140.75 / 152.87 · 75.0 g / 16.37 s · +57.3 cv / +104.0 N·m · patinação 1.22 s · sem quebra
nitrous-progressive 50% strategic 11.19  16.89  31.07 · km/h 114.03 / 140.02 / 154.30 · 75.0 g / 16.12 s · +57.3 cv / +97.8 N·m · patinação 0.55 s · sem quebra
nitrous-progressive 75% continuous 10.61  16.17  31.15 · km/h 117.19 / 137.02 / 148.56 · 75.0 g / 11.15 s · +85.9 cv / +145.2 N·m · patinação 1.00 s · sem quebra
nitrous-progressive 75% strategic 11.01  16.55  31.28 · km/h 115.92 / 140.74 / 150.01 · 75.0 g / 10.90 s · +85.9 cv / +136.7 N·m · patinação 0.55 s · sem quebra
nitrous-progressive 100% continuous 11.88  18.48  35.06 · km/h  98.00 / 117.28 / 139.52 · 75.0 g / 9.88 s · +114.5 cv / +180.3 N·m · patinação 1.30 s · sem quebra
nitrous-progressive 100% strategic 12.08  18.59  34.99 · km/h  97.88 / 119.48 / 140.39 · 75.0 g / 9.64 s · +114.5 cv / +180.3 N·m · patinação 0.55 s · sem quebra
nitrous-direct desligado       12.32  19.16  35.73 · km/h  94.34 / 115.83 / 140.67 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.56 s · sem quebra
nitrous-direct 25% continuous  11.10  17.06  31.36 · km/h 109.22 / 132.90 / 162.40 · 104.0 g / 28.67 s · +37.7 cv / +69.8 N·m · patinação 0.82 s · sem quebra
nitrous-direct 25% strategic   11.50  17.49  31.82 · km/h 108.17 / 132.36 / 162.23 · 99.0 g / 27.07 s · +37.7 cv / +65.1 N·m · patinação 0.56 s · sem quebra
nitrous-direct 50% continuous  10.64  16.16  30.12 · km/h 116.13 / 145.19 / 155.30 · 115.0 g / 16.08 s · +75.5 cv / +127.9 N·m · patinação 1.01 s · sem quebra
nitrous-direct 50% strategic   11.05  16.62  30.45 · km/h 115.06 / 144.40 / 156.68 · 115.0 g / 15.98 s · +75.5 cv / +123.9 N·m · patinação 0.56 s · sem quebra
nitrous-direct 75% continuous  11.85  18.27  34.31 · km/h  98.11 / 123.76 / 142.03 · 115.0 g / 12.60 s · +113.2 cv / +179.0 N·m · patinação 1.32 s · sem quebra
nitrous-direct 75% strategic   12.07  18.47  34.29 · km/h  97.92 / 126.63 / 143.19 · 115.0 g / 12.36 s · +113.2 cv / +179.0 N·m · patinação 0.56 s · sem quebra
nitrous-direct 100% continuous 12.33  18.88  35.18 · km/h  95.60 / 120.68 / 140.80 · 115.0 g / 11.69 s · +150.9 cv / +215.4 N·m · patinação 1.33 s · sem quebra
nitrous-direct 100% strategic  12.44  18.96  35.00 · km/h  95.55 / 123.87 / 142.08 · 115.0 g / 11.44 s · +150.9 cv / +215.4 N·m · patinação 0.56 s · sem quebra

== Capítulo 1: Volkswagen Gol GTS 1988 — AP 1.8S Original (vw-gol-gts-1988) — 201 m / 402 m / 1000 m (s)
sem kit                        11.15  17.16  31.60
nitrous-street desligado       11.17  17.19  31.65 · km/h 107.23 / 130.86 / 160.24 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.68 s · sem quebra
nitrous-street 25% continuous  10.90  16.71  30.67 · km/h 111.39 / 135.89 / 166.60 · 18.2 g / 27.90 s · +11.2 cv / +19.7 N·m · patinação 1.43 s · sem quebra
nitrous-street 25% strategic   10.97  16.80  30.76 · km/h 111.12 / 135.75 / 166.55 · 17.2 g / 26.29 s · +11.2 cv / +18.8 N·m · patinação 0.68 s · sem quebra
nitrous-street 50% continuous  10.71  16.35  30.20 · km/h 115.11 / 140.60 / 164.07 · 20.0 g / 15.56 s · +22.5 cv / +41.4 N·m · patinação 1.60 s · sem quebra
nitrous-street 50% strategic   10.80  16.46  30.24 · km/h 114.68 / 140.37 / 164.69 · 20.0 g / 15.38 s · +22.5 cv / +37.2 N·m · patinação 0.68 s · sem quebra
nitrous-street 75% continuous  10.57  16.10  30.04 · km/h 118.29 / 140.74 / 163.38 · 20.0 g / 10.75 s · +33.7 cv / +57.0 N·m · patinação 1.54 s · sem quebra
nitrous-street 75% strategic   10.65  16.18  30.05 · km/h 117.93 / 141.91 / 163.77 · 20.0 g / 10.43 s · +33.7 cv / +55.0 N·m · patinação 0.68 s · sem quebra
nitrous-street 100% continuous 10.44  15.99  29.99 · km/h 121.32 / 139.35 / 162.92 · 20.0 g / 8.26 s · +45.0 cv / +74.6 N·m · patinação 1.47 s · sem quebra
nitrous-street 100% strategic  10.52  16.02  29.97 · km/h 120.95 / 140.54 / 163.32 · 20.0 g / 7.95 s · +45.0 cv / +72.3 N·m · patinação 0.68 s · sem quebra
nitrous-wet desligado          11.18  17.21  31.68 · km/h 107.13 / 130.76 / 160.16 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.63 s · sem quebra
nitrous-wet 25% continuous     10.76  16.45  30.09 · km/h 114.06 / 139.27 / 170.99 · 35.7 g / 27.41 s · +19.5 cv / +35.9 N·m · patinação 1.74 s · sem quebra
nitrous-wet 25% strategic      10.86  16.56  30.21 · km/h 113.66 / 139.06 / 170.93 · 33.7 g / 25.72 s · +19.5 cv / +32.4 N·m · patinação 0.63 s · sem quebra
nitrous-wet 50% continuous     10.51  15.95  29.34 · km/h 119.68 / 146.75 / 167.70 · 40.0 g / 15.71 s · +39.0 cv / +65.9 N·m · patinação 1.42 s · sem quebra
nitrous-wet 50% strategic      10.60  16.05  29.39 · km/h 119.27 / 146.53 / 168.41 · 40.0 g / 15.38 s · +39.0 cv / +63.2 N·m · patinação 0.63 s · sem quebra
nitrous-wet 75% continuous     10.32  15.57  29.13 · km/h 122.08 / 148.39 / 166.00 · 40.0 g / 10.75 s · +58.5 cv / +95.8 N·m · patinação 2.30 s · sem quebra
nitrous-wet 75% strategic      10.40  15.65  29.13 · km/h 121.62 / 150.09 / 166.64 · 40.0 g / 10.43 s · +58.5 cv / +93.6 N·m · patinação 0.63 s · sem quebra
nitrous-wet 100% continuous    10.23  15.44  29.09 · km/h 125.40 / 146.51 / 165.33 · 40.0 g / 8.43 s · +78.0 cv / +125.5 N·m · patinação 2.30 s · sem quebra
nitrous-wet 100% strategic     10.34  15.51  29.06 · km/h 124.59 / 148.55 / 166.06 · 40.0 g / 8.25 s · +78.0 cv / +125.2 N·m · patinação 0.65 s · sem quebra
nitrous-progressive desligado  11.19  17.22  31.70 · km/h 107.04 / 130.66 / 160.02 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.64 s · sem quebra
nitrous-progressive 25% continuous 10.65  16.22  29.53 · km/h 116.66 / 142.76 / 175.59 · 60.8 g / 26.41 s · +28.6 cv / +50.4 N·m · patinação 1.49 s · sem quebra
nitrous-progressive 25% strategic 10.74  16.32  29.64 · km/h 116.29 / 142.55 / 175.52 · 58.6 g / 25.15 s · +28.6 cv / +47.0 N·m · patinação 0.64 s · sem quebra
nitrous-progressive 50% continuous 10.31  15.54  28.40 · km/h 121.79 / 152.93 / 173.17 · 75.0 g / 16.68 s · +57.3 cv / +94.9 N·m · patinação 2.41 s · sem quebra
nitrous-progressive 50% strategic 10.42  15.67  28.47 · km/h 121.60 / 152.62 / 174.30 · 75.0 g / 16.34 s · +57.3 cv / +91.7 N·m · patinação 0.64 s · sem quebra
nitrous-progressive 75% continuous 10.22  15.23  28.31 · km/h 126.32 / 158.26 / 169.96 · 75.0 g / 11.45 s · +85.9 cv / +140.4 N·m · patinação 2.86 s · sem quebra
nitrous-progressive 75% strategic 10.32  15.35  28.29 · km/h 125.55 / 157.84 / 171.31 · 75.0 g / 11.41 s · +85.9 cv / +138.0 N·m · patinação 0.66 s · sem quebra
nitrous-progressive 100% continuous 10.24  15.42  29.05 · km/h 127.66 / 147.61 / 165.93 · 75.0 g / 9.12 s · +114.5 cv / +180.2 N·m · patinação 2.72 s · sem quebra
nitrous-progressive 100% strategic 10.33  15.49  28.96 · km/h 126.78 / 150.18 / 167.03 · 75.0 g / 9.10 s · +114.5 cv / +172.9 N·m · patinação 0.68 s · sem quebra
nitrous-direct desligado       11.20  17.23  31.72 · km/h 106.92 / 130.53 / 160.19 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.64 s · sem quebra
nitrous-direct 25% continuous  10.54  16.00  29.02 · km/h 119.14 / 146.05 / 179.87 · 92.8 g / 25.84 s · +37.7 cv / +64.7 N·m · patinação 1.36 s · sem quebra
nitrous-direct 25% strategic   10.63  16.10  29.13 · km/h 118.70 / 145.81 / 179.79 · 89.6 g / 24.65 s · +37.7 cv / +61.3 N·m · patinação 0.64 s · sem quebra
nitrous-direct 50% continuous  10.24  15.31  27.76 · km/h 124.84 / 158.16 / 177.58 · 115.0 g / 16.53 s · +75.5 cv / +121.3 N·m · patinação 2.29 s · sem quebra
nitrous-direct 50% strategic   10.33  15.42  27.81 · km/h 124.22 / 157.85 / 178.81 · 115.0 g / 16.21 s · +75.5 cv / +121.3 N·m · patinação 0.65 s · sem quebra
nitrous-direct 75% continuous  10.24  15.20  28.13 · km/h 127.55 / 159.86 / 171.32 · 115.0 g / 11.54 s · +113.2 cv / +178.8 N·m · patinação 2.73 s · sem quebra
nitrous-direct 75% strategic   10.33  15.32  28.07 · km/h 126.64 / 159.39 / 172.91 · 115.0 g / 11.53 s · +113.2 cv / +170.9 N·m · patinação 0.68 s · sem quebra
nitrous-direct 100% continuous 10.76  16.30  30.07 · km/h 113.35 / 145.27 / 164.87 · 115.0 g / 10.76 s · +150.9 cv / +227.3 N·m · patinação 2.77 s · sem quebra
nitrous-direct 100% strategic  10.73  16.25  29.78 · km/h 113.92 / 147.36 / 166.64 · 115.0 g / 10.90 s · +150.9 cv / +227.3 N·m · patinação 0.69 s · sem quebra

== Capítulo 1: Volkswagen Saveiro GL 1.8 1994 (vw-saveiro-gl-1994) — 201 m / 402 m / 1000 m (s)
sem kit                        11.46  17.78  33.28
nitrous-street desligado       11.47  17.80  33.32 · km/h 102.52 / 123.66 / 148.90 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.59 s · sem quebra
nitrous-street 25% continuous  11.15  17.24  32.11 · km/h 106.87 / 128.89 / 155.29 · 19.5 g / 29.70 s · +11.2 cv / +20.1 N·m · patinação 0.87 s · sem quebra
nitrous-street 25% strategic   11.24  17.35  32.23 · km/h 106.59 / 128.75 / 155.25 · 18.6 g / 28.17 s · +11.2 cv / +19.4 N·m · patinação 0.59 s · sem quebra
nitrous-street 50% continuous  10.90  16.79  31.60 · km/h 110.84 / 133.78 / 152.11 · 20.0 g / 15.55 s · +22.5 cv / +41.1 N·m · patinação 1.43 s · sem quebra
nitrous-street 50% strategic   11.05  16.96  31.69 · km/h 110.34 / 133.53 / 152.59 · 20.0 g / 15.40 s · +22.5 cv / +38.4 N·m · patinação 0.59 s · sem quebra
nitrous-street 75% continuous  10.71  16.51  31.48 · km/h 114.47 / 132.52 / 151.30 · 20.0 g / 10.60 s · +33.7 cv / +63.8 N·m · patinação 1.44 s · sem quebra
nitrous-street 75% strategic   10.88  16.65  31.52 · km/h 113.80 / 134.23 / 151.78 · 20.0 g / 10.44 s · +33.7 cv / +56.8 N·m · patinação 0.59 s · sem quebra
nitrous-street 100% continuous 10.54  16.39  31.45 · km/h 116.45 / 131.04 / 150.89 · 20.0 g / 7.97 s · +45.0 cv / +83.0 N·m · patinação 2.08 s · sem quebra
nitrous-street 100% strategic  10.73  16.49  31.44 · km/h 116.99 / 132.85 / 151.39 · 20.0 g / 7.96 s · +45.0 cv / +74.6 N·m · patinação 0.59 s · sem quebra
nitrous-wet desligado          11.48  17.81  33.34 · km/h 102.43 / 123.57 / 148.84 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.57 s · sem quebra
nitrous-wet 25% continuous     10.96  16.91  31.41 · km/h 109.74 / 132.42 / 158.29 · 37.5 g / 28.72 s · +19.5 cv / +35.2 N·m · patinação 1.39 s · sem quebra
nitrous-wet 25% strategic      11.11  17.07  31.58 · km/h 109.28 / 132.19 / 158.22 · 35.6 g / 27.17 s · +19.5 cv / +33.4 N·m · patinação 0.58 s · sem quebra
nitrous-wet 50% continuous     10.67  16.32  30.62 · km/h 115.72 / 140.15 / 154.83 · 40.0 g / 15.72 s · +39.0 cv / +67.8 N·m · patinação 1.46 s · sem quebra
nitrous-wet 50% strategic      10.82  16.49  30.71 · km/h 115.22 / 139.89 / 155.41 · 40.0 g / 15.40 s · +39.0 cv / +65.1 N·m · patinação 0.58 s · sem quebra
nitrous-wet 75% continuous     10.47  15.93  30.44 · km/h 118.14 / 140.59 / 153.56 · 40.0 g / 10.75 s · +58.5 cv / +98.9 N·m · patinação 1.70 s · sem quebra
nitrous-wet 75% strategic      10.59  16.04  30.45 · km/h 117.83 / 142.37 / 154.07 · 40.0 g / 10.45 s · +58.5 cv / +97.0 N·m · patinação 0.58 s · sem quebra
nitrous-wet 100% continuous    10.34  15.82  30.48 · km/h 122.19 / 137.91 / 152.79 · 40.0 g / 8.27 s · +78.0 cv / +128.6 N·m · patinação 2.52 s · sem quebra
nitrous-wet 100% strategic     10.48  15.88  30.40 · km/h 121.43 / 140.29 / 153.47 · 40.0 g / 8.12 s · +78.0 cv / +128.6 N·m · patinação 0.59 s · sem quebra
nitrous-progressive desligado  11.49  17.83  33.36 · km/h 102.35 / 123.48 / 148.77 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.58 s · sem quebra
nitrous-progressive 25% continuous 10.82  16.62  30.76 · km/h 112.57 / 136.06 / 163.00 · 64.5 g / 27.95 s · +28.6 cv / +51.0 N·m · patinação 1.48 s · sem quebra
nitrous-progressive 25% strategic 10.97  16.79  30.93 · km/h 112.08 / 135.81 / 162.93 · 61.8 g / 26.52 s · +28.6 cv / +48.5 N·m · patinação 0.58 s · sem quebra
nitrous-progressive 50% continuous 10.47  15.90  29.64 · km/h 117.98 / 146.57 / 158.47 · 75.0 g / 16.68 s · +57.3 cv / +98.2 N·m · patinação 1.68 s · sem quebra
nitrous-progressive 50% strategic 10.61  16.05  29.72 · km/h 117.52 / 146.26 / 159.49 · 75.0 g / 16.36 s · +57.3 cv / +94.9 N·m · patinação 0.58 s · sem quebra
nitrous-progressive 75% continuous 10.30  15.47  29.43 · km/h 123.22 / 150.73 / 155.43 · 75.0 g / 11.45 s · +85.9 cv / +141.2 N·m · patinação 2.62 s · sem quebra
nitrous-progressive 75% strategic 10.49  15.67  29.52 · km/h 122.17 / 153.54 / 156.55 · 75.0 g / 11.28 s · +85.9 cv / +140.8 N·m · patinação 0.61 s · sem quebra
nitrous-progressive 100% continuous 10.32  15.69  30.26 · km/h 124.55 / 140.76 / 152.62 · 75.0 g / 9.12 s · +114.5 cv / +181.2 N·m · patinação 2.55 s · sem quebra
nitrous-progressive 100% strategic 10.48  15.83  30.28 · km/h 123.48 / 142.89 / 153.35 · 75.0 g / 9.12 s · +114.5 cv / +175.9 N·m · patinação 0.63 s · sem quebra
nitrous-direct desligado       11.49  17.84  33.39 · km/h 102.24 / 123.37 / 148.68 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.58 s · sem quebra
nitrous-direct 25% continuous  10.70  16.38  30.18 · km/h 115.16 / 139.45 / 167.40 · 97.7 g / 27.15 s · +37.7 cv / +66.3 N·m · patinação 1.35 s · sem quebra
nitrous-direct 25% strategic   10.85  16.54  30.36 · km/h 114.64 / 139.19 / 167.33 · 94.4 g / 25.93 s · +37.7 cv / +63.2 N·m · patinação 0.59 s · sem quebra
nitrous-direct 50% continuous  10.35  15.59  28.90 · km/h 121.65 / 152.16 / 162.08 · 115.0 g / 16.39 s · +75.5 cv / +125.1 N·m · patinação 2.56 s · sem quebra
nitrous-direct 50% strategic   10.50  15.76  28.97 · km/h 120.77 / 151.75 / 163.72 · 115.0 g / 16.22 s · +75.5 cv / +124.6 N·m · patinação 0.60 s · sem quebra
nitrous-direct 75% continuous  10.40  15.52  29.42 · km/h 124.07 / 152.38 / 156.05 · 115.0 g / 11.26 s · +113.2 cv / +188.1 N·m · patinação 2.43 s · sem quebra
nitrous-direct 75% strategic   10.49  15.62  29.32 · km/h 123.50 / 153.91 / 158.00 · 115.0 g / 11.39 s · +113.2 cv / +178.9 N·m · patinação 0.63 s · sem quebra
nitrous-direct 100% continuous 11.04  16.81  31.60 · km/h 109.25 / 137.31 / 151.41 · 115.0 g / 10.90 s · +150.9 cv / +228.3 N·m · patinação 2.43 s · sem quebra
nitrous-direct 100% strategic  10.92  16.62  31.04 · km/h 110.85 / 141.84 / 153.44 · 115.0 g / 11.06 s · +150.9 cv / +228.2 N·m · patinação 0.65 s · sem quebra

== Capítulo 2: Volkswagen Golf GTI 1.8T 2003 (vw-golf-gti-mk4-2003) — 201 m / 402 m / 1000 m (s)
sem kit                        10.31  15.65  28.12
nitrous-street desligado       10.32  15.67  28.15 · km/h 119.61 / 149.06 / 190.32 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 1.83 s · sem quebra
nitrous-street 25% continuous  10.22  15.46  27.70 · km/h 122.16 / 152.28 / 194.61 · 15.6 g / 24.10 s · +11.2 cv / +24.3 N·m · patinação 2.03 s · sem quebra
nitrous-street 25% strategic   10.23  15.47  27.71 · km/h 122.09 / 152.24 / 194.59 · 15.1 g / 23.00 s · +11.2 cv / +18.4 N·m · patinação 1.83 s · sem quebra
nitrous-street 50% continuous  10.13  15.29  27.39 · km/h 124.56 / 155.36 / 194.23 · 20.0 g / 15.68 s · +22.5 cv / +44.3 N·m · patinação 2.14 s · sem quebra
nitrous-street 50% strategic   10.14  15.30  27.39 · km/h 124.43 / 155.28 / 194.57 · 20.0 g / 15.47 s · +22.5 cv / +36.4 N·m · patinação 1.83 s · sem quebra
nitrous-street 75% continuous  10.05  15.13  27.28 · km/h 126.85 / 156.97 / 193.42 · 20.0 g / 10.72 s · +33.7 cv / +62.1 N·m · patinação 2.08 s · sem quebra
nitrous-street 75% strategic   10.06  15.14  27.26 · km/h 126.63 / 157.68 / 193.71 · 20.0 g / 10.36 s · +33.7 cv / +54.0 N·m · patinação 1.83 s · sem quebra
nitrous-street 100% continuous  9.97  15.02  27.22 · km/h 129.02 / 155.91 / 192.99 · 20.0 g / 8.24 s · +45.0 cv / +78.3 N·m · patinação 2.12 s · sem quebra
nitrous-street 100% strategic   9.99  15.03  27.19 · km/h 128.69 / 156.72 / 193.32 · 20.0 g / 7.88 s · +45.0 cv / +71.2 N·m · patinação 1.83 s · sem quebra
nitrous-wet desligado          10.32  15.67  28.16 · km/h 119.53 / 148.97 / 190.22 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 1.79 s · sem quebra
nitrous-wet 25% continuous     10.16  15.34  27.41 · km/h 123.85 / 154.45 / 197.48 · 30.8 g / 23.86 s · +19.5 cv / +41.4 N·m · patinação 2.16 s · sem quebra
nitrous-wet 25% strategic      10.17  15.35  27.42 · km/h 123.74 / 154.39 / 197.46 · 29.7 g / 22.71 s · +19.5 cv / +31.7 N·m · patinação 1.79 s · sem quebra
nitrous-wet 50% continuous     10.01  15.04  26.89 · km/h 127.79 / 159.52 / 197.22 · 40.0 g / 15.89 s · +39.0 cv / +71.6 N·m · patinação 2.12 s · sem quebra
nitrous-wet 50% strategic      10.03  15.07  26.90 · km/h 127.53 / 159.37 / 197.74 · 40.0 g / 15.47 s · +39.0 cv / +62.2 N·m · patinação 1.79 s · sem quebra
nitrous-wet 75% continuous      9.88  14.79  26.71 · km/h 131.36 / 162.63 / 195.72 · 40.0 g / 10.77 s · +58.5 cv / +100.4 N·m · patinação 2.06 s · sem quebra
nitrous-wet 75% strategic       9.91  14.83  26.71 · km/h 130.94 / 163.71 / 196.19 · 40.0 g / 10.36 s · +58.5 cv / +91.2 N·m · patinação 1.79 s · sem quebra
nitrous-wet 100% continuous     9.81  14.68  26.65 · km/h 134.18 / 161.29 / 195.15 · 40.0 g / 8.46 s · +78.0 cv / +130.0 N·m · patinação 2.91 s · sem quebra
nitrous-wet 100% strategic      9.85  14.71  26.64 · km/h 133.70 / 162.42 / 195.63 · 40.0 g / 8.03 s · +78.0 cv / +118.6 N·m · patinação 1.80 s · sem quebra
nitrous-progressive desligado  10.33  15.68  28.18 · km/h 119.45 / 148.87 / 190.12 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 1.81 s · sem quebra
nitrous-progressive 25% continuous 10.09  15.21  27.10 · km/h 125.65 / 156.78 / 200.51 · 54.0 g / 23.63 s · +28.6 cv / +58.7 N·m · patinação 2.12 s · sem quebra
nitrous-progressive 25% strategic 10.11  15.22  27.12 · km/h 125.48 / 156.68 / 200.48 · 52.2 g / 22.41 s · +28.6 cv / +46.2 N·m · patinação 1.81 s · sem quebra
nitrous-progressive 50% continuous  9.89  14.80  26.34 · km/h 131.07 / 163.77 / 201.45 · 75.0 g / 16.74 s · +57.3 cv / +98.8 N·m · patinação 2.09 s · sem quebra
nitrous-progressive 50% strategic  9.93  14.85  26.37 · km/h 130.65 / 163.53 / 202.15 · 75.0 g / 16.27 s · +57.3 cv / +89.6 N·m · patinação 1.81 s · sem quebra
nitrous-progressive 75% continuous  9.79  14.56  26.16 · km/h 135.05 / 169.41 / 199.11 · 75.0 g / 11.50 s · +85.9 cv / +141.7 N·m · patinação 3.04 s · sem quebra
nitrous-progressive 75% strategic  9.86  14.65  26.18 · km/h 134.30 / 169.00 / 200.07 · 75.0 g / 11.35 s · +85.9 cv / +129.7 N·m · patinação 1.82 s · sem quebra
nitrous-progressive 100% continuous  9.79  14.56  26.38 · km/h 134.18 / 165.17 / 196.78 · 75.0 g / 9.03 s · +114.5 cv / +177.3 N·m · patinação 2.93 s · sem quebra
nitrous-progressive 100% strategic  9.84  14.60  26.34 · km/h 134.25 / 166.90 / 197.56 · 75.0 g / 8.73 s · +114.5 cv / +167.6 N·m · patinação 1.83 s · sem quebra
nitrous-direct desligado       10.34  15.69  28.20 · km/h 119.34 / 148.74 / 189.99 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 1.81 s · sem quebra
nitrous-direct 25% continuous  10.03  15.08  26.82 · km/h 127.36 / 158.97 / 203.35 · 83.2 g / 23.32 s · +37.7 cv / +73.6 N·m · patinação 2.07 s · sem quebra
nitrous-direct 25% strategic   10.05  15.11  26.85 · km/h 127.09 / 158.83 / 203.30 · 80.5 g / 22.13 s · +37.7 cv / +60.3 N·m · patinação 1.81 s · sem quebra
nitrous-direct 50% continuous   9.81  14.62  25.93 · km/h 133.83 / 167.53 / 204.40 · 115.0 g / 16.44 s · +75.5 cv / +127.0 N·m · patinação 3.29 s · sem quebra
nitrous-direct 50% strategic    9.87  14.70  25.98 · km/h 133.15 / 167.15 / 205.52 · 115.0 g / 16.13 s · +75.5 cv / +115.4 N·m · patinação 1.82 s · sem quebra
nitrous-direct 75% continuous   9.79  14.53  26.00 · km/h 134.32 / 171.30 / 200.59 · 115.0 g / 11.59 s · +113.2 cv / +176.3 N·m · patinação 2.79 s · sem quebra
nitrous-direct 75% strategic    9.84  14.59  26.01 · km/h 134.39 / 171.36 / 201.31 · 115.0 g / 11.31 s · +113.2 cv / +165.9 N·m · patinação 1.83 s · sem quebra
nitrous-direct 100% continuous 10.27  15.62  28.31 · km/h 118.36 / 148.27 / 188.37 · 115.0 g / 9.05 s · +150.9 cv / +240.4 N·m · patinação 3.00 s · sem quebra
nitrous-direct 100% strategic  10.13  15.38  27.84 · km/h 120.36 / 152.42 / 190.58 · 115.0 g / 9.03 s · +150.9 cv / +240.4 N·m · patinação 1.85 s · sem quebra

== Capítulo 2: BMW 320i F30 2014 (bmw-320i-f30-2014) — 201 m / 402 m / 1000 m (s)
sem kit                         9.99  15.36  27.97
nitrous-street desligado        9.99  15.37  27.99 · km/h 119.65 / 148.08 / 187.85 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.92 s · sem quebra
nitrous-street 25% continuous   9.88  15.16  27.52 · km/h 121.87 / 151.15 / 192.30 · 16.1 g / 24.86 s · +11.2 cv / +19.1 N·m · patinação 0.92 s · sem quebra
nitrous-street 25% strategic    9.90  15.18  27.54 · km/h 121.81 / 151.11 / 192.28 · 15.7 g / 24.17 s · +11.2 cv / +16.5 N·m · patinação 0.92 s · sem quebra
nitrous-street 50% continuous   9.77  14.96  27.21 · km/h 123.99 / 154.05 / 191.67 · 20.0 g / 15.71 s · +22.5 cv / +37.3 N·m · patinação 1.36 s · sem quebra
nitrous-street 50% strategic    9.81  15.00  27.24 · km/h 123.86 / 153.98 / 191.88 · 20.0 g / 15.47 s · +22.5 cv / +33.0 N·m · patinação 0.92 s · sem quebra
nitrous-street 75% continuous   9.70  14.81  27.10 · km/h 125.94 / 155.40 / 191.07 · 20.0 g / 10.79 s · +33.7 cv / +54.8 N·m · patinação 1.22 s · sem quebra
nitrous-street 75% strategic    9.73  14.83  27.11 · km/h 125.83 / 155.62 / 191.16 · 20.0 g / 10.51 s · +33.7 cv / +49.4 N·m · patinação 0.92 s · sem quebra
nitrous-street 100% continuous  9.63  14.72  27.05 · km/h 127.84 / 154.51 / 190.66 · 20.0 g / 8.14 s · +45.0 cv / +70.6 N·m · patinação 1.20 s · sem quebra
nitrous-street 100% strategic   9.65  14.73  27.05 · km/h 127.70 / 154.73 / 190.76 · 20.0 g / 7.88 s · +45.0 cv / +65.7 N·m · patinação 0.92 s · sem quebra
nitrous-wet desligado          10.00  15.38  28.01 · km/h 119.58 / 147.99 / 187.75 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.92 s · sem quebra
nitrous-wet 25% continuous      9.81  15.02  27.22 · km/h 123.37 / 153.21 / 195.24 · 31.7 g / 24.72 s · +19.5 cv / +30.2 N·m · patinação 1.07 s · sem quebra
nitrous-wet 25% strategic       9.84  15.05  27.25 · km/h 123.25 / 153.14 / 195.21 · 31.1 g / 23.87 s · +19.5 cv / +28.6 N·m · patinação 0.92 s · sem quebra
nitrous-wet 50% continuous      9.67  14.73  26.73 · km/h 126.77 / 157.92 / 194.70 · 40.0 g / 15.89 s · +39.0 cv / +59.7 N·m · patinação 1.27 s · sem quebra
nitrous-wet 50% strategic       9.70  14.76  26.75 · km/h 126.63 / 157.84 / 194.90 · 40.0 g / 15.47 s · +39.0 cv / +57.0 N·m · patinação 0.92 s · sem quebra
nitrous-wet 75% continuous      9.54  14.48  26.53 · km/h 129.97 / 160.65 / 193.47 · 40.0 g / 10.87 s · +58.5 cv / +86.9 N·m · patinação 1.24 s · sem quebra
nitrous-wet 75% strategic       9.57  14.51  26.55 · km/h 129.80 / 160.94 / 193.62 · 40.0 g / 10.51 s · +58.5 cv / +85.3 N·m · patinação 0.91 s · sem quebra
nitrous-wet 100% continuous     9.43  14.31  26.42 · km/h 132.96 / 159.53 / 192.94 · 40.0 g / 8.41 s · +78.0 cv / +115.5 N·m · patinação 1.21 s · sem quebra
nitrous-wet 100% strategic      9.46  14.34  26.43 · km/h 132.75 / 159.79 / 193.06 · 40.0 g / 8.03 s · +78.0 cv / +113.4 N·m · patinação 0.91 s · sem quebra
nitrous-progressive desligado  10.00  15.39  28.02 · km/h 119.52 / 147.91 / 187.66 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.92 s · sem quebra
nitrous-progressive 25% continuous  9.74  14.88  26.90 · km/h 124.95 / 155.39 / 198.32 · 56.0 g / 24.52 s · +28.6 cv / +43.9 N·m · patinação 1.22 s · sem quebra
nitrous-progressive 25% strategic  9.78  14.92  26.94 · km/h 124.80 / 155.31 / 198.29 · 54.5 g / 23.55 s · +28.6 cv / +41.9 N·m · patinação 0.92 s · sem quebra
nitrous-progressive 50% continuous  9.57  14.51  26.18 · km/h 129.69 / 161.93 / 199.26 · 75.0 g / 16.61 s · +57.3 cv / +85.1 N·m · patinação 0.99 s · sem quebra
nitrous-progressive 50% strategic  9.58  14.53  26.19 · km/h 129.52 / 161.83 / 199.47 · 75.0 g / 16.27 s · +57.3 cv / +83.5 N·m · patinação 0.91 s · sem quebra
nitrous-progressive 75% continuous  9.40  14.17  25.91 · km/h 134.06 / 167.82 / 197.00 · 75.0 g / 11.39 s · +85.9 cv / +127.0 N·m · patinação 0.97 s · sem quebra
nitrous-progressive 75% strategic  9.42  14.20  25.92 · km/h 133.82 / 167.73 / 197.18 · 75.0 g / 11.05 s · +85.9 cv / +124.8 N·m · patinação 0.90 s · sem quebra
nitrous-progressive 100% continuous  9.26  13.94  25.76 · km/h 138.02 / 165.98 / 196.06 · 75.0 g / 8.75 s · +114.5 cv / +168.7 N·m · patinação 0.98 s · sem quebra
nitrous-progressive 100% strategic  9.28  13.96  25.76 · km/h 137.75 / 166.29 / 196.21 · 75.0 g / 8.44 s · +114.5 cv / +166.0 N·m · patinação 0.90 s · sem quebra
nitrous-direct desligado       10.01  15.40  28.04 · km/h 119.43 / 147.80 / 187.54 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.90 s · sem quebra
nitrous-direct 25% continuous   9.70  14.78  26.64 · km/h 126.39 / 157.42 / 201.20 · 85.1 g / 23.90 s · +37.7 cv / +56.2 N·m · patinação 1.02 s · sem quebra
nitrous-direct 25% strategic    9.72  14.80  26.66 · km/h 126.25 / 157.34 / 201.16 · 84.1 g / 23.25 s · +37.7 cv / +55.2 N·m · patinação 0.89 s · sem quebra
nitrous-direct 50% continuous   9.46  14.30  25.71 · km/h 132.43 / 165.66 / 202.63 · 115.0 g / 16.48 s · +75.5 cv / +111.9 N·m · patinação 1.01 s · sem quebra
nitrous-direct 50% strategic    9.49  14.33  25.73 · km/h 132.19 / 165.52 / 202.84 · 115.0 g / 16.13 s · +75.5 cv / +109.8 N·m · patinação 0.89 s · sem quebra
nitrous-direct 75% continuous   9.28  13.92  25.41 · km/h 137.72 / 172.90 / 199.76 · 115.0 g / 11.21 s · +113.2 cv / +167.0 N·m · patinação 1.02 s · sem quebra
nitrous-direct 75% strategic    9.30  13.94  25.41 · km/h 137.47 / 172.76 / 200.01 · 115.0 g / 10.86 s · +113.2 cv / +164.4 N·m · patinação 0.88 s · sem quebra
nitrous-direct 100% continuous  9.12  13.65  25.25 · km/h 142.17 / 170.81 / 198.50 · 115.0 g / 8.63 s · +150.9 cv / +223.6 N·m · patinação 1.00 s · sem quebra
nitrous-direct 100% strategic   9.14  13.67  25.25 · km/h 141.93 / 171.18 / 198.70 · 115.0 g / 8.29 s · +150.9 cv / +220.3 N·m · patinação 0.87 s · sem quebra

== Capítulo 2: Mitsubishi Lancer Evolution X 2012 (mitsubishi-evo-x-2012) — 201 m / 402 m / 1000 m (s)
sem kit                         8.89  13.67  24.91
nitrous-street desligado        8.90  13.68  24.94 · km/h 134.29 / 165.99 / 210.01 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.00 s · sem quebra
nitrous-street 25% continuous   8.76  13.48  24.59 · km/h 136.07 / 168.13 / 212.70 · 15.6 g / 24.15 s · +11.2 cv / +22.7 N·m · patinação 0.04 s · sem quebra
nitrous-street 25% strategic    8.85  13.57  24.68 · km/h 135.93 / 168.05 / 212.67 · 14.2 g / 21.92 s · +11.2 cv / +15.5 N·m · patinação 0.00 s · sem quebra
nitrous-street 50% continuous   8.63  13.29  24.33 · km/h 137.83 / 170.23 / 212.25 · 20.0 g / 15.62 s · +22.5 cv / +44.1 N·m · patinação 0.07 s · sem quebra
nitrous-street 50% strategic    8.79  13.46  24.48 · km/h 137.54 / 170.08 / 212.74 · 20.0 g / 15.47 s · +22.5 cv / +30.9 N·m · patinação 0.00 s · sem quebra
nitrous-street 75% continuous   8.51  13.13  24.21 · km/h 139.53 / 170.44 / 211.66 · 20.0 g / 10.66 s · +33.7 cv / +64.2 N·m · patinação 0.09 s · sem quebra
nitrous-street 75% strategic    8.73  13.35  24.38 · km/h 139.11 / 171.92 / 212.22 · 20.0 g / 10.51 s · +33.7 cv / +46.3 N·m · patinação 0.00 s · sem quebra
nitrous-street 100% continuous  8.39  13.02  24.13 · km/h 141.06 / 169.65 / 211.36 · 20.0 g / 8.03 s · +45.0 cv / +83.4 N·m · patinação 0.12 s · sem quebra
nitrous-street 100% strategic   8.68  13.28  24.34 · km/h 140.66 / 171.07 / 211.90 · 20.0 g / 8.03 s · +45.0 cv / +61.5 N·m · patinação 0.00 s · sem quebra
nitrous-wet desligado           8.91  13.69  24.95 · km/h 134.23 / 165.92 / 209.93 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.00 s · sem quebra
nitrous-wet 25% continuous      8.67  13.35  24.36 · km/h 137.28 / 169.59 / 214.59 · 31.0 g / 23.94 s · +19.5 cv / +38.6 N·m · patinação 0.06 s · sem quebra
nitrous-wet 25% strategic       8.81  13.49  24.51 · km/h 137.03 / 169.45 / 214.54 · 28.2 g / 21.75 s · +19.5 cv / +26.8 N·m · patinação 0.00 s · sem quebra
nitrous-wet 50% continuous      8.46  13.04  23.94 · km/h 140.24 / 173.16 / 213.90 · 40.0 g / 15.62 s · +39.0 cv / +75.7 N·m · patinação 0.09 s · sem quebra
nitrous-wet 50% strategic       8.72  13.31  24.18 · km/h 139.76 / 172.91 / 214.76 · 40.0 g / 15.62 s · +39.0 cv / +53.3 N·m · patinação 0.00 s · sem quebra
nitrous-wet 75% continuous      8.27  12.78  23.74 · km/h 143.08 / 173.97 / 212.96 · 40.0 g / 10.66 s · +58.5 cv / +108.5 N·m · patinação 0.17 s · sem quebra
nitrous-wet 75% strategic       8.63  13.15  24.02 · km/h 142.39 / 176.26 / 213.87 · 40.0 g / 10.51 s · +58.5 cv / +79.5 N·m · patinação 0.00 s · sem quebra
nitrous-wet 100% continuous     8.13  12.65  23.66 · km/h 145.71 / 172.67 / 212.46 · 40.0 g / 8.18 s · +78.0 cv / +141.2 N·m · patinação 0.17 s · sem quebra
nitrous-wet 100% strategic      8.55  13.02  23.94 · km/h 144.91 / 175.05 / 213.37 · 40.0 g / 8.03 s · +78.0 cv / +105.4 N·m · patinação 0.00 s · sem quebra
nitrous-progressive desligado   8.92  13.70  24.96 · km/h 134.14 / 165.83 / 209.85 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.00 s · sem quebra
nitrous-progressive 25% continuous  8.57  13.21  24.12 · km/h 138.60 / 171.19 / 216.67 · 54.6 g / 23.71 s · +28.6 cv / +55.7 N·m · patinação 0.03 s · sem quebra
nitrous-progressive 25% strategic  8.77  13.42  24.33 · km/h 138.25 / 171.00 / 216.60 · 49.8 g / 21.57 s · +28.6 cv / +39.3 N·m · patinação 0.00 s · sem quebra
nitrous-progressive 50% continuous  8.28  12.79  23.51 · km/h 142.82 / 176.33 / 216.44 · 75.0 g / 16.57 s · +57.3 cv / +106.1 N·m · patinação 0.17 s · sem quebra
nitrous-progressive 50% strategic  8.64  13.16  23.83 · km/h 142.15 / 175.96 / 218.09 · 75.0 g / 16.42 s · +57.3 cv / +77.9 N·m · patinação 0.00 s · sem quebra
nitrous-progressive 75% continuous  8.08  12.48  23.24 · km/h 146.67 / 179.53 / 215.07 · 75.0 g / 11.35 s · +85.9 cv / +152.6 N·m · patinação 0.16 s · sem quebra
nitrous-progressive 75% strategic  8.52  12.94  23.60 · km/h 145.82 / 180.75 / 216.26 · 75.0 g / 11.05 s · +85.9 cv / +115.9 N·m · patinação 0.00 s · sem quebra
nitrous-progressive 100% continuous  7.91  12.29  23.12 · km/h 149.97 / 177.52 / 214.29 · 75.0 g / 8.74 s · +114.5 cv / +198.5 N·m · patinação 0.23 s · sem quebra
nitrous-progressive 100% strategic  8.42  12.75  23.48 · km/h 149.23 / 180.72 / 215.55 · 75.0 g / 8.44 s · +114.5 cv / +153.2 N·m · patinação 0.00 s · sem quebra
nitrous-direct desligado        8.92  13.71  24.98 · km/h 134.05 / 165.73 / 209.75 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.00 s · sem quebra
nitrous-direct 25% continuous   8.48  13.08  23.89 · km/h 139.87 / 172.73 / 218.69 · 84.4 g / 23.48 s · +37.7 cv / +73.5 N·m · patinação 0.08 s · sem quebra
nitrous-direct 25% strategic    8.73  13.34  24.17 · km/h 139.40 / 172.48 / 218.60 · 77.2 g / 21.40 s · +37.7 cv / +51.6 N·m · patinação 0.00 s · sem quebra
nitrous-direct 50% continuous   8.13  12.57  23.14 · km/h 145.26 / 179.37 / 218.53 · 115.0 g / 16.28 s · +75.5 cv / +135.8 N·m · patinação 0.26 s · sem quebra
nitrous-direct 50% strategic    8.57  13.03  23.54 · km/h 144.40 / 178.90 / 220.58 · 115.0 g / 16.13 s · +75.5 cv / +102.1 N·m · patinação 0.00 s · sem quebra
nitrous-direct 75% continuous   7.92  12.23  22.85 · km/h 149.79 / 183.83 / 216.73 · 115.0 g / 11.16 s · +113.2 cv / +196.6 N·m · patinação 0.22 s · sem quebra
nitrous-direct 75% strategic    8.43  12.75  23.27 · km/h 149.00 / 184.99 / 218.12 · 115.0 g / 10.86 s · +113.2 cv / +151.4 N·m · patinação 0.00 s · sem quebra
nitrous-direct 100% continuous  7.85  12.11  22.80 · km/h 152.93 / 181.72 / 215.89 · 115.0 g / 8.59 s · +150.9 cv / +249.2 N·m · patinação 0.62 s · sem quebra
nitrous-direct 100% strategic   8.30  12.53  23.11 · km/h 151.92 / 185.18 / 217.27 · 115.0 g / 8.29 s · +150.9 cv / +199.4 N·m · patinação 0.00 s · sem quebra

== Capítulo 3: Nissan 350Z Coupé 2006 (nissan-350z-2006) — 201 m / 402 m / 1000 m (s)
sem kit                         9.38  14.11  24.99
nitrous-street desligado        9.38  14.12  25.01 · km/h 135.24 / 169.79 / 221.06 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.67 s · sem quebra
nitrous-street 25% continuous   9.31  13.99  24.75 · km/h 137.05 / 172.06 / 224.07 · 14.1 g / 21.78 s · +11.2 cv / +19.2 N·m · patinação 1.21 s · sem quebra
nitrous-street 25% strategic    9.34  14.02  24.78 · km/h 136.90 / 171.97 / 224.03 · 13.2 g / 20.22 s · +11.2 cv / +16.2 N·m · patinação 0.67 s · sem quebra
nitrous-street 50% continuous   9.27  13.90  24.57 · km/h 138.69 / 174.20 / 224.35 · 20.0 g / 15.62 s · +22.5 cv / +37.7 N·m · patinação 1.56 s · sem quebra
nitrous-street 50% strategic    9.29  13.93  24.59 · km/h 138.49 / 174.09 / 224.88 · 20.0 g / 15.47 s · +22.5 cv / +32.2 N·m · patinação 0.67 s · sem quebra
nitrous-street 75% continuous   9.26  13.85  24.55 · km/h 140.13 / 175.65 / 223.53 · 20.0 g / 10.51 s · +33.7 cv / +56.1 N·m · patinação 1.48 s · sem quebra
nitrous-street 75% strategic    9.25  13.84  24.50 · km/h 140.02 / 176.13 / 224.05 · 20.0 g / 10.36 s · +33.7 cv / +48.1 N·m · patinação 0.67 s · sem quebra
nitrous-street 100% continuous  9.19  13.76  24.47 · km/h 141.59 / 175.37 / 223.41 · 20.0 g / 8.17 s · +45.0 cv / +72.3 N·m · patinação 1.47 s · sem quebra
nitrous-street 100% strategic   9.20  13.76  24.44 · km/h 141.50 / 176.15 / 223.75 · 20.0 g / 7.88 s · +45.0 cv / +63.7 N·m · patinação 0.67 s · sem quebra
nitrous-wet desligado           9.39  14.13  25.03 · km/h 135.15 / 169.69 / 220.95 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.67 s · sem quebra
nitrous-wet 25% continuous      9.27  13.92  24.59 · km/h 138.21 / 173.56 / 226.09 · 28.2 g / 21.69 s · +19.5 cv / +34.7 N·m · patinação 1.61 s · sem quebra
nitrous-wet 25% strategic       9.31  13.96  24.63 · km/h 137.99 / 173.43 / 226.03 · 26.2 g / 20.08 s · +19.5 cv / +28.0 N·m · patinação 0.67 s · sem quebra
nitrous-wet 50% continuous      9.21  13.78  24.30 · km/h 140.75 / 177.03 / 227.08 · 40.0 g / 15.76 s · +39.0 cv / +66.9 N·m · patinação 1.50 s · sem quebra
nitrous-wet 50% strategic       9.23  13.80  24.31 · km/h 140.63 / 176.96 / 227.59 · 40.0 g / 15.47 s · +39.0 cv / +55.5 N·m · patinação 0.67 s · sem quebra
nitrous-wet 75% continuous      9.16  13.66  24.20 · km/h 143.21 / 180.34 / 225.69 · 40.0 g / 10.66 s · +58.5 cv / +96.2 N·m · patinação 1.35 s · sem quebra
nitrous-wet 75% strategic       9.16  13.66  24.17 · km/h 143.12 / 180.28 / 226.18 · 40.0 g / 10.51 s · +58.5 cv / +82.4 N·m · patinação 0.67 s · sem quebra
nitrous-wet 100% continuous     9.11  13.57  24.14 · km/h 143.05 / 179.44 / 225.13 · 40.0 g / 8.18 s · +78.0 cv / +123.3 N·m · patinação 1.30 s · sem quebra
nitrous-wet 100% strategic      9.10  13.54  24.08 · km/h 143.00 / 180.64 / 225.67 · 40.0 g / 7.88 s · +78.0 cv / +108.8 N·m · patinação 0.67 s · sem quebra
nitrous-progressive desligado   9.39  14.14  25.04 · km/h 135.07 / 169.60 / 220.84 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.67 s · sem quebra
nitrous-progressive 25% continuous  9.23  13.84  24.42 · km/h 139.40 / 175.15 / 228.24 · 48.9 g / 21.26 s · +28.6 cv / +53.4 N·m · patinação 1.71 s · sem quebra
nitrous-progressive 25% strategic  9.28  13.89  24.47 · km/h 139.16 / 175.01 / 228.18 · 46.2 g / 19.91 s · +28.6 cv / +40.9 N·m · patinação 0.67 s · sem quebra
nitrous-progressive 50% continuous  9.17  13.68  24.01 · km/h 142.98 / 180.04 / 230.62 · 75.0 g / 16.57 s · +57.3 cv / +100.0 N·m · patinação 1.33 s · sem quebra
nitrous-progressive 50% strategic  9.17  13.68  24.00 · km/h 142.88 / 179.98 / 231.39 · 75.0 g / 16.27 s · +57.3 cv / +80.7 N·m · patinação 0.67 s · sem quebra
nitrous-progressive 75% continuous  9.10  13.50  23.84 · km/h 143.02 / 184.64 / 228.55 · 75.0 g / 11.35 s · +85.9 cv / +140.7 N·m · patinação 1.39 s · sem quebra
nitrous-progressive 75% strategic  9.08  13.48  23.77 · km/h 142.93 / 184.54 / 229.46 · 75.0 g / 11.05 s · +85.9 cv / +119.2 N·m · patinação 0.67 s · sem quebra
nitrous-progressive 100% continuous  9.02  13.34  23.74 · km/h 145.41 / 184.82 / 227.56 · 75.0 g / 8.59 s · +114.5 cv / +177.2 N·m · patinação 1.77 s · sem quebra
nitrous-progressive 100% strategic  9.01  13.32  23.66 · km/h 145.07 / 186.51 / 228.36 · 75.0 g / 8.29 s · +114.5 cv / +158.9 N·m · patinação 0.67 s · sem quebra
nitrous-direct desligado        9.40  14.15  25.05 · km/h 134.96 / 169.46 / 220.69 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.67 s · sem quebra
nitrous-direct 25% continuous   9.22  13.80  24.29 · km/h 140.41 / 176.58 / 230.25 · 74.8 g / 20.91 s · +37.7 cv / +68.7 N·m · patinação 1.48 s · sem quebra
nitrous-direct 25% strategic    9.25  13.83  24.32 · km/h 140.28 / 176.51 / 230.22 · 71.6 g / 19.77 s · +37.7 cv / +53.8 N·m · patinação 0.67 s · sem quebra
nitrous-direct 50% continuous   9.12  13.56  23.75 · km/h 143.18 / 182.90 / 233.26 · 115.0 g / 16.28 s · +75.5 cv / +126.0 N·m · patinação 1.37 s · sem quebra
nitrous-direct 50% strategic    9.12  13.56  23.73 · km/h 143.17 / 182.80 / 234.14 · 115.0 g / 15.98 s · +75.5 cv / +105.7 N·m · patinação 0.67 s · sem quebra
nitrous-direct 75% continuous   9.03  13.34  23.52 · km/h 145.17 / 185.39 / 230.82 · 115.0 g / 11.16 s · +113.2 cv / +175.1 N·m · patinação 1.67 s · sem quebra
nitrous-direct 75% strategic    9.01  13.33  23.46 · km/h 144.88 / 185.28 / 231.88 · 115.0 g / 10.86 s · +113.2 cv / +157.0 N·m · patinação 0.67 s · sem quebra
nitrous-direct 100% continuous  8.98  13.20  23.46 · km/h 148.35 / 186.98 / 229.53 · 115.0 g / 8.59 s · +150.9 cv / +218.3 N·m · patinação 1.85 s · sem quebra
nitrous-direct 100% strategic   8.97  13.19  23.38 · km/h 147.80 / 188.91 / 230.53 · 115.0 g / 8.44 s · +150.9 cv / +208.9 N·m · patinação 0.68 s · sem quebra

== Capítulo 3: Nissan 370Z Coupé 2014 (nissan-370z-2014) — 201 m / 402 m / 1000 m (s)
sem kit                         9.07  13.64  24.12
nitrous-street desligado        9.08  13.65  24.14 · km/h 140.53 / 176.41 / 229.77 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 1.14 s · sem quebra
nitrous-street 25% continuous   9.04  13.56  23.94 · km/h 142.13 / 178.49 / 232.60 · 13.7 g / 21.13 s · +11.2 cv / +18.7 N·m · patinação 1.64 s · sem quebra
nitrous-street 25% strategic    9.03  13.56  23.94 · km/h 142.10 / 178.47 / 232.59 · 12.8 g / 19.57 s · +11.2 cv / +15.2 N·m · patinação 1.14 s · sem quebra
nitrous-street 50% continuous   8.98  13.47  23.76 · km/h 143.68 / 180.51 / 233.26 · 20.0 g / 15.68 s · +22.5 cv / +36.6 N·m · patinação 1.66 s · sem quebra
nitrous-street 50% strategic    8.99  13.48  23.76 · km/h 143.62 / 180.48 / 233.58 · 20.0 g / 15.47 s · +22.5 cv / +30.2 N·m · patinação 1.14 s · sem quebra
nitrous-street 75% continuous   8.96  13.40  23.70 · km/h 145.10 / 182.44 / 232.45 · 20.0 g / 10.65 s · +33.7 cv / +53.7 N·m · patinação 1.48 s · sem quebra
nitrous-street 75% strategic    8.95  13.40  23.68 · km/h 145.08 / 182.43 / 232.72 · 20.0 g / 10.51 s · +33.7 cv / +45.1 N·m · patinação 1.14 s · sem quebra
nitrous-street 100% continuous  8.92  13.34  23.67 · km/h 145.23 / 181.98 / 232.12 · 20.0 g / 8.18 s · +45.0 cv / +70.0 N·m · patinação 1.41 s · sem quebra
nitrous-street 100% strategic   8.92  13.33  23.63 · km/h 145.16 / 182.68 / 232.42 · 20.0 g / 7.88 s · +45.0 cv / +59.8 N·m · patinação 1.14 s · sem quebra
nitrous-wet desligado           9.08  13.65  24.15 · km/h 140.45 / 176.31 / 229.66 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 1.10 s · sem quebra
nitrous-wet 25% continuous      9.00  13.49  23.80 · km/h 143.19 / 179.88 / 234.49 · 26.5 g / 20.56 s · +19.5 cv / +33.5 N·m · patinação 1.70 s · sem quebra
nitrous-wet 25% strategic       9.01  13.50  23.81 · km/h 143.13 / 179.85 / 234.48 · 25.3 g / 19.43 s · +19.5 cv / +26.2 N·m · patinação 1.10 s · sem quebra
nitrous-wet 50% continuous      8.94  13.37  23.52 · km/h 145.50 / 183.25 / 235.82 · 40.0 g / 15.77 s · +39.0 cv / +64.2 N·m · patinação 1.41 s · sem quebra
nitrous-wet 50% strategic       8.94  13.37  23.51 · km/h 145.47 / 183.21 / 236.29 · 40.0 g / 15.47 s · +39.0 cv / +51.9 N·m · patinação 1.10 s · sem quebra
nitrous-wet 75% continuous      8.88  13.24  23.41 · km/h 144.85 / 186.49 / 234.37 · 40.0 g / 10.81 s · +58.5 cv / +92.4 N·m · patinação 1.42 s · sem quebra
nitrous-wet 75% strategic       8.88  13.24  23.38 · km/h 144.81 / 186.40 / 234.93 · 40.0 g / 10.51 s · +58.5 cv / +77.1 N·m · patinação 1.10 s · sem quebra
nitrous-wet 100% continuous     8.83  13.13  23.34 · km/h 146.36 / 186.01 / 233.82 · 40.0 g / 8.18 s · +78.0 cv / +118.6 N·m · patinação 1.57 s · sem quebra
nitrous-wet 100% strategic      8.83  13.13  23.30 · km/h 146.16 / 187.12 / 234.32 · 40.0 g / 7.88 s · +78.0 cv / +102.3 N·m · patinação 1.10 s · sem quebra
nitrous-progressive desligado   9.08  13.66  24.17 · km/h 140.36 / 176.20 / 229.54 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 1.03 s · sem quebra
nitrous-progressive 25% continuous  8.97  13.44  23.66 · km/h 144.32 / 181.38 / 236.54 · 46.6 g / 20.39 s · +28.6 cv / +50.9 N·m · patinação 1.47 s · sem quebra
nitrous-progressive 25% strategic  8.98  13.44  23.67 · km/h 144.26 / 181.34 / 236.52 · 44.7 g / 19.29 s · +28.6 cv / +38.4 N·m · patinação 1.03 s · sem quebra
nitrous-progressive 50% continuous  8.88  13.24  23.24 · km/h 144.79 / 186.22 / 239.37 · 75.0 g / 16.57 s · +57.3 cv / +95.2 N·m · patinação 1.52 s · sem quebra
nitrous-progressive 50% strategic  8.89  13.25  23.24 · km/h 144.79 / 186.10 / 239.58 · 75.0 g / 16.27 s · +57.3 cv / +75.7 N·m · patinação 1.03 s · sem quebra
nitrous-progressive 75% continuous  8.80  13.06  23.05 · km/h 147.08 / 187.56 / 237.33 · 75.0 g / 11.35 s · +85.9 cv / +134.4 N·m · patinação 1.74 s · sem quebra
nitrous-progressive 75% strategic  8.81  13.08  23.03 · km/h 146.74 / 187.42 / 238.14 · 75.0 g / 11.05 s · +85.9 cv / +112.7 N·m · patinação 1.03 s · sem quebra
nitrous-progressive 100% continuous  8.75  12.93  22.97 · km/h 149.76 / 189.10 / 236.28 · 75.0 g / 8.71 s · +114.5 cv / +169.5 N·m · patinação 1.52 s · sem quebra
nitrous-progressive 100% strategic  8.74  12.94  22.93 · km/h 149.40 / 190.28 / 236.89 · 75.0 g / 8.44 s · +114.5 cv / +150.2 N·m · patinação 1.03 s · sem quebra
nitrous-direct desligado        9.09  13.67  24.18 · km/h 140.25 / 176.07 / 229.39 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.96 s · sem quebra
nitrous-direct 25% continuous   8.95  13.38  23.53 · km/h 145.38 / 182.82 / 238.48 · 72.3 g / 20.24 s · +37.7 cv / +65.8 N·m · patinação 1.38 s · sem quebra
nitrous-direct 25% strategic    8.95  13.39  23.53 · km/h 145.30 / 182.76 / 238.45 · 69.4 g / 19.16 s · +37.7 cv / +50.3 N·m · patinação 0.96 s · sem quebra
nitrous-direct 50% continuous   8.83  13.13  22.99 · km/h 146.09 / 187.63 / 239.83 · 115.0 g / 16.28 s · +75.5 cv / +120.8 N·m · patinação 1.62 s · sem quebra
nitrous-direct 50% strategic    8.84  13.15  23.01 · km/h 145.82 / 187.68 / 240.54 · 115.0 g / 15.98 s · +75.5 cv / +99.0 N·m · patinação 0.96 s · sem quebra
nitrous-direct 75% continuous   8.75  12.94  22.77 · km/h 149.51 / 190.50 / 239.66 · 115.0 g / 11.29 s · +113.2 cv / +168.2 N·m · patinação 1.54 s · sem quebra
nitrous-direct 75% strategic    8.75  12.95  22.74 · km/h 149.16 / 190.31 / 239.09 · 115.0 g / 10.86 s · +113.2 cv / +148.4 N·m · patinação 0.96 s · sem quebra
nitrous-direct 100% continuous  8.70  12.81  22.71 · km/h 152.69 / 193.04 / 238.23 · 115.0 g / 8.75 s · +150.9 cv / +208.4 N·m · patinação 2.16 s · sem quebra
nitrous-direct 100% strategic   8.71  12.82  22.66 · km/h 152.14 / 194.76 / 239.28 · 115.0 g / 8.44 s · +150.9 cv / +199.0 N·m · patinação 0.97 s · sem quebra

== Capítulo 3: Kia Stinger GT 2019 AWD (kia-stinger-gt-2019) — 201 m / 402 m / 1000 m (s)
sem kit                         8.56  13.14  23.80
nitrous-street desligado        8.57  13.15  23.82 · km/h 139.85 / 174.12 / 223.92 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.00 s · sem quebra
nitrous-street 25% continuous   8.50  13.04  23.60 · km/h 141.25 / 175.90 / 226.32 · 14.4 g / 22.37 s · +11.2 cv / +18.8 N·m · patinação 0.00 s · sem quebra
nitrous-street 25% strategic    8.52  13.06  23.63 · km/h 141.17 / 175.85 / 226.30 · 13.7 g / 21.13 s · +11.2 cv / +16.9 N·m · patinação 0.00 s · sem quebra
nitrous-street 50% continuous   8.43  12.93  23.42 · km/h 142.61 / 177.64 / 226.45 · 20.0 g / 15.83 s · +22.5 cv / +37.2 N·m · patinação 0.00 s · sem quebra
nitrous-street 50% strategic    8.48  12.98  23.47 · km/h 142.45 / 177.55 / 226.73 · 20.0 g / 15.62 s · +22.5 cv / +33.8 N·m · patinação 0.00 s · sem quebra
nitrous-street 75% continuous   8.37  12.82  23.34 · km/h 143.94 / 178.65 / 225.86 · 20.0 g / 10.73 s · +33.7 cv / +55.1 N·m · patinação 0.00 s · sem quebra
nitrous-street 75% strategic    8.44  12.90  23.39 · km/h 143.71 / 179.22 / 226.12 · 20.0 g / 10.51 s · +33.7 cv / +50.7 N·m · patinação 0.00 s · sem quebra
nitrous-street 100% continuous  8.30  12.75  23.29 · km/h 145.18 / 177.97 / 225.57 · 20.0 g / 8.26 s · +45.0 cv / +72.6 N·m · patinação 0.00 s · sem quebra
nitrous-street 100% strategic   8.39  12.83  23.35 · km/h 144.80 / 178.63 / 225.86 · 20.0 g / 8.03 s · +45.0 cv / +67.5 N·m · patinação 0.00 s · sem quebra
nitrous-wet desligado           8.57  13.16  23.83 · km/h 139.79 / 174.04 / 223.84 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.00 s · sem quebra
nitrous-wet 25% continuous      8.45  12.96  23.45 · km/h 142.19 / 177.10 / 227.95 · 28.7 g / 22.29 s · +19.5 cv / +34.0 N·m · patinação 0.00 s · sem quebra
nitrous-wet 25% strategic       8.49  13.01  23.50 · km/h 142.05 / 177.02 / 227.92 · 27.2 g / 21.01 s · +19.5 cv / +29.3 N·m · patinação 0.00 s · sem quebra
nitrous-wet 50% continuous      8.33  12.77  23.15 · km/h 144.27 / 180.06 / 228.28 · 40.0 g / 15.83 s · +39.0 cv / +66.5 N·m · patinação 0.00 s · sem quebra
nitrous-wet 50% strategic       8.42  12.86  23.23 · km/h 144.19 / 179.90 / 228.76 · 40.0 g / 15.62 s · +39.0 cv / +58.6 N·m · patinação 0.00 s · sem quebra
nitrous-wet 75% continuous      8.29  12.67  23.08 · km/h 146.30 / 181.80 / 227.20 · 40.0 g / 10.78 s · +58.5 cv / +97.6 N·m · patinação 0.00 s · sem quebra
nitrous-wet 75% strategic       8.35  12.73  23.10 · km/h 146.24 / 182.68 / 227.72 · 40.0 g / 10.51 s · +58.5 cv / +87.8 N·m · patinação 0.00 s · sem quebra
nitrous-wet 100% continuous     8.20  12.56  23.01 · km/h 148.17 / 180.71 / 226.72 · 40.0 g / 8.30 s · +78.0 cv / +127.3 N·m · patinação 0.00 s · sem quebra
nitrous-wet 100% strategic      8.28  12.63  23.03 · km/h 148.03 / 181.96 / 227.27 · 40.0 g / 8.03 s · +78.0 cv / +116.8 N·m · patinação 0.00 s · sem quebra
nitrous-progressive desligado   8.58  13.17  23.84 · km/h 139.72 / 173.96 / 223.75 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.00 s · sem quebra
nitrous-progressive 25% continuous  8.39  12.87  23.28 · km/h 143.22 / 178.43 / 229.74 · 50.8 g / 22.19 s · +28.6 cv / +52.1 N·m · patinação 0.00 s · sem quebra
nitrous-progressive 25% strategic  8.46  12.94  23.36 · km/h 143.01 / 178.30 / 229.69 · 48.1 g / 20.87 s · +28.6 cv / +43.0 N·m · patinação 0.00 s · sem quebra
nitrous-progressive 50% continuous  8.29  12.68  22.91 · km/h 146.09 / 182.46 / 230.94 · 75.0 g / 16.69 s · +57.3 cv / +100.4 N·m · patinação 0.00 s · sem quebra
nitrous-progressive 50% strategic  8.36  12.74  22.96 · km/h 146.03 / 182.43 / 231.73 · 75.0 g / 16.42 s · +57.3 cv / +85.9 N·m · patinação 0.00 s · sem quebra
nitrous-progressive 75% continuous  8.08  12.37  22.63 · km/h 149.24 / 186.54 / 229.31 · 75.0 g / 11.28 s · +85.9 cv / +145.4 N·m · patinação 0.23 s · sem quebra
nitrous-progressive 75% strategic  8.26  12.56  22.77 · km/h 148.69 / 186.37 / 230.07 · 75.0 g / 11.20 s · +85.9 cv / +128.4 N·m · patinação 0.00 s · sem quebra
nitrous-progressive 100% continuous  8.08  12.33  22.63 · km/h 151.44 / 185.23 / 228.70 · 75.0 g / 8.87 s · +114.5 cv / +186.6 N·m · patinação 0.33 s · sem quebra
nitrous-progressive 100% strategic  8.17  12.41  22.66 · km/h 151.29 / 186.59 / 229.33 · 75.0 g / 8.44 s · +114.5 cv / +170.9 N·m · patinação 0.00 s · sem quebra
nitrous-direct desligado        8.58  13.17  23.86 · km/h 139.63 / 173.86 / 223.63 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.00 s · sem quebra
nitrous-direct 25% continuous   8.34  12.79  23.13 · km/h 144.19 / 179.69 / 231.46 · 78.8 g / 22.04 s · +37.7 cv / +67.9 N·m · patinação 0.00 s · sem quebra
nitrous-direct 25% strategic    8.43  12.89  23.23 · km/h 143.92 / 179.52 / 231.39 · 74.7 g / 20.72 s · +37.7 cv / +56.7 N·m · patinação 0.00 s · sem quebra
nitrous-direct 50% continuous   8.20  12.53  22.64 · km/h 147.79 / 184.93 / 232.98 · 115.0 g / 16.40 s · +75.5 cv / +129.5 N·m · patinação 0.01 s · sem quebra
nitrous-direct 50% strategic    8.30  12.64  22.73 · km/h 147.62 / 184.83 / 233.95 · 115.0 g / 16.13 s · +75.5 cv / +113.1 N·m · patinação 0.00 s · sem quebra
nitrous-direct 75% continuous   8.09  12.31  22.45 · km/h 151.23 / 189.53 / 231.10 · 115.0 g / 11.44 s · +113.2 cv / +184.9 N·m · patinação 0.33 s · sem quebra
nitrous-direct 75% strategic    8.19  12.41  22.49 · km/h 151.07 / 189.44 / 231.93 · 115.0 g / 11.01 s · +113.2 cv / +169.1 N·m · patinação 0.00 s · sem quebra
nitrous-direct 100% continuous  8.01  12.17  22.35 · km/h 154.53 / 188.81 / 230.26 · 115.0 g / 8.77 s · +150.9 cv / +234.9 N·m · patinação 0.30 s · sem quebra
nitrous-direct 100% strategic   8.08  12.22  22.36 · km/h 154.38 / 190.30 / 230.94 · 115.0 g / 8.29 s · +150.9 cv / +225.0 N·m · patinação 0.00 s · sem quebra

== Capítulo 3: Nissan GT-R R35 Premium 2015 (nissan-gtr-r35-2015) — 201 m / 402 m / 1000 m (s)
sem kit                         7.52  11.51  20.72
nitrous-street desligado        7.53  11.52  20.73 · km/h 159.37 / 200.33 / 260.17 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.19 s · sem quebra
nitrous-street 25% continuous   7.48  11.44  20.59 · km/h 160.49 / 201.84 / 262.16 · 12.6 g / 19.78 s · +11.2 cv / +20.9 N·m · patinação 0.21 s · sem quebra
nitrous-street 25% strategic    7.50  11.46  20.61 · km/h 160.38 / 201.64 / 262.03 · 11.9 g / 18.42 s · +11.2 cv / +17.1 N·m · patinação 0.19 s · sem quebra
nitrous-street 50% continuous   7.44  11.38  20.48 · km/h 161.45 / 202.96 / 262.64 · 20.0 g / 15.94 s · +22.5 cv / +41.2 N·m · patinação 0.20 s · sem quebra
nitrous-street 50% strategic    7.47  11.41  20.50 · km/h 161.40 / 202.94 / 262.96 · 20.0 g / 15.62 s · +22.5 cv / +34.2 N·m · patinação 0.19 s · sem quebra
nitrous-street 75% continuous   7.42  11.34  20.44 · km/h 162.41 / 204.23 / 262.04 · 20.0 g / 10.83 s · +33.7 cv / +61.7 N·m · patinação 0.24 s · sem quebra
nitrous-street 75% strategic    7.44  11.36  20.44 · km/h 162.40 / 204.23 / 262.33 · 20.0 g / 10.51 s · +33.7 cv / +51.1 N·m · patinação 0.19 s · sem quebra
nitrous-street 100% continuous  7.40  11.30  20.43 · km/h 163.38 / 203.77 / 261.72 · 20.0 g / 8.22 s · +45.0 cv / +81.8 N·m · patinação 0.30 s · sem quebra
nitrous-street 100% strategic   7.41  11.31  20.41 · km/h 163.40 / 204.45 / 262.03 · 20.0 g / 8.03 s · +45.0 cv / +68.0 N·m · patinação 0.19 s · sem quebra
nitrous-wet desligado           7.53  11.53  20.74 · km/h 159.28 / 200.23 / 260.06 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.19 s · sem quebra
nitrous-wet 25% continuous      7.46  11.41  20.52 · km/h 161.07 / 202.50 / 263.29 · 25.0 g / 19.68 s · +19.5 cv / +36.0 N·m · patinação 0.22 s · sem quebra
nitrous-wet 25% strategic       7.48  11.43  20.54 · km/h 161.05 / 202.49 / 263.28 · 23.7 g / 18.35 s · +19.5 cv / +29.7 N·m · patinação 0.19 s · sem quebra
nitrous-wet 50% continuous      7.42  11.32  20.34 · km/h 162.81 / 204.88 / 264.56 · 40.0 g / 15.94 s · +39.0 cv / +71.0 N·m · patinação 0.27 s · sem quebra
nitrous-wet 50% strategic       7.43  11.34  20.35 · km/h 162.79 / 204.73 / 264.96 · 40.0 g / 15.62 s · +39.0 cv / +59.1 N·m · patinação 0.19 s · sem quebra
nitrous-wet 75% continuous      7.36  11.23  20.26 · km/h 164.50 / 206.93 / 263.38 · 40.0 g / 10.86 s · +58.5 cv / +104.2 N·m · patinação 0.34 s · sem quebra
nitrous-wet 75% strategic       7.38  11.25  20.25 · km/h 164.50 / 206.93 / 263.85 · 40.0 g / 10.51 s · +58.5 cv / +88.2 N·m · patinação 0.19 s · sem quebra
nitrous-wet 100% continuous     7.31  11.16  20.21 · km/h 166.26 / 206.35 / 262.82 · 40.0 g / 8.35 s · +78.0 cv / +137.2 N·m · patinação 0.38 s · sem quebra
nitrous-wet 100% strategic      7.33  11.17  20.20 · km/h 166.17 / 207.51 / 263.36 · 40.0 g / 8.03 s · +78.0 cv / +116.9 N·m · patinação 0.19 s · sem quebra
nitrous-progressive desligado   7.54  11.54  20.76 · km/h 159.18 / 200.12 / 259.94 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.19 s · sem quebra
nitrous-progressive 25% continuous  7.42  11.35  20.41 · km/h 161.90 / 203.66 / 264.79 · 44.2 g / 19.57 s · +28.6 cv / +52.2 N·m · patinação 0.22 s · sem quebra
nitrous-progressive 25% strategic  7.46  11.39  20.46 · km/h 161.78 / 203.44 / 264.66 · 41.9 g / 18.27 s · +28.6 cv / +43.6 N·m · patinação 0.19 s · sem quebra
nitrous-progressive 50% continuous  7.36  11.23  20.16 · km/h 164.39 / 206.87 / 267.31 · 75.0 g / 16.77 s · +57.3 cv / +101.7 N·m · patinação 0.33 s · sem quebra
nitrous-progressive 50% strategic  7.39  11.26  20.19 · km/h 164.30 / 206.69 / 267.90 · 75.0 g / 16.42 s · +57.3 cv / +86.5 N·m · patinação 0.19 s · sem quebra
nitrous-progressive 75% continuous  7.30  11.11  20.03 · km/h 166.87 / 209.92 / 265.38 · 75.0 g / 11.37 s · +85.9 cv / +150.3 N·m · patinação 0.38 s · sem quebra
nitrous-progressive 75% strategic  7.32  11.14  20.03 · km/h 166.77 / 209.87 / 266.05 · 75.0 g / 11.05 s · +85.9 cv / +128.6 N·m · patinação 0.19 s · sem quebra
nitrous-progressive 100% continuous  7.23  11.00  19.96 · km/h 169.34 / 210.35 / 264.60 · 75.0 g / 8.77 s · +114.5 cv / +198.9 N·m · patinação 0.39 s · sem quebra
nitrous-progressive 100% strategic  7.26  11.03  19.94 · km/h 169.16 / 211.89 / 265.33 · 75.0 g / 8.44 s · +114.5 cv / +169.7 N·m · patinação 0.19 s · sem quebra
nitrous-direct desligado        7.54  11.54  20.77 · km/h 159.09 / 200.01 / 259.80 · 0.0 g / 0.00 s · +0.0 cv / +0.0 N·m · patinação 0.19 s · sem quebra
nitrous-direct 25% continuous   7.41  11.33  20.35 · km/h 162.49 / 204.35 / 265.99 · 68.7 g / 19.45 s · +37.7 cv / +68.7 N·m · patinação 0.24 s · sem quebra
nitrous-direct 25% strategic    7.44  11.36  20.38 · km/h 162.48 / 204.36 / 265.99 · 65.2 g / 18.18 s · +37.7 cv / +57.1 N·m · patinação 0.19 s · sem quebra
nitrous-direct 50% continuous   7.32  11.16  20.02 · km/h 165.83 / 208.62 / 269.17 · 115.0 g / 16.48 s · +75.5 cv / +132.4 N·m · patinação 0.36 s · sem quebra
nitrous-direct 50% strategic    7.35  11.19  20.04 · km/h 165.75 / 208.58 / 270.05 · 115.0 g / 16.13 s · +75.5 cv / +113.1 N·m · patinação 0.19 s · sem quebra
nitrous-direct 75% continuous   7.24  11.01  19.85 · km/h 169.10 / 212.78 / 266.90 · 115.0 g / 11.19 s · +113.2 cv / +196.7 N·m · patinação 0.38 s · sem quebra
nitrous-direct 75% strategic    7.27  11.04  19.85 · km/h 168.93 / 212.68 / 267.72 · 115.0 g / 10.86 s · +113.2 cv / +167.5 N·m · patinação 0.19 s · sem quebra
nitrous-direct 100% continuous  7.16  10.87  19.75 · km/h 172.22 / 213.40 / 265.97 · 115.0 g / 8.63 s · +150.9 cv / +255.7 N·m · patinação 0.67 s · sem quebra
nitrous-direct 100% strategic   7.19  10.90  19.74 · km/h 171.96 / 215.21 / 266.80 · 115.0 g / 8.29 s · +150.9 cv / +218.9 N·m · patinação 0.19 s · sem quebra
```
