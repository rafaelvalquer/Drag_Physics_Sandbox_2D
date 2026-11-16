# Carros da campanha — fichas de referência

Gerado por `npx tsx scripts/docs-campaign-cars.ts` a partir dos dados e de medições da própria física do jogo
(dinamômetro do motor e teste de aceleração na Test Track). Não editar à mão.

Regras seguidas:

- Cada valor tem origem: **fábrica/ficha** (fonte listada), **derivado** (calculado de valores documentados),
  **estimado** (não encontrado em fonte; valor plausível, marcado no código) ou **calibrado** (ajustado para a
  física reproduzir um alvo documentado — nunca o torque: a curva passa pelos pontos documentados).
- Divergências entre fontes ficam registradas, e a fonte escolhida é dita.
- A arte dos carros é original e procedural (silhueta, proporções e detalhes de época), sem fotos nem logotipos.
- O Gol GTS 1988 é o mesmo objeto do Sandbox; sua ficha completa está em [vw-gol-gts-1988.md](vw-gol-gts-1988.md).

| carro | potência alvo | medida | torque alvo | medido | 0–100 alvo | simulado | carga do teste |
|---|---:|---:|---:|---:|---:|---:|---:|
| Volkswagen Gol GTS 1988 — AP 1.8S Original | 99,0 cv @ 5600 | 99,0 cv @ 5600 | 146,0 N·m @ 3200 | 146,0 N·m @ 3200 | 9,7 s | 9,90 s | 0 kg |
| Fiat Uno Mille Electronic 1.0 1995 | 56,1 cv @ 6000 | 56,1 cv @ 6000 | 80,4 N·m @ 3250 | 80,4 N·m @ 3200 | 18,2 s | 16,57 s | 90 kg |
| Chevrolet Chevette SL 1.6/S 1988 | 72,0 cv @ 5600 | 72,0 cv @ 5600 | 120,6 N·m @ 3200 | 120,6 N·m @ 3200 | 16,9 s | 14,41 s | 90 kg |
| Chevrolet Celta 1.0 2003 | 70,0 cv @ 6400 | 70,0 cv @ 6400 | 86,3 N·m @ 3000 | 86,3 N·m @ 3000 | 13,1 s | 14,87 s | 90 kg |
| Chevrolet Corsa GL 1.4 1996 | 60,0 cv @ 5200 | 60,0 cv @ 5200 | 108,9 N·m @ 2800 | 108,9 N·m @ 2800 | 15,5 s | 15,53 s | 90 kg |
| Chevrolet Kadett SL 1.8 1992 | 98,0 cv @ 5800 | 98,0 cv @ 5800 | 143,2 N·m @ 3600 | 143,2 N·m @ 3600 | 12,3 s | 11,09 s | 90 kg |
| Volkswagen Saveiro GL 1.8 1994 | 88,0 cv @ 5600 | 88,0 cv @ 5600 | 146,1 N·m @ 3200 | 146,1 N·m @ 3200 | 11,8 s | 11,63 s | 90 kg |

Medido = varredura do dinamômetro do jogo (borboleta toda aberta, 1600 rpm até o corte, passo de 200 rpm). Simulado =
teste de aceleração do jogo com piloto automático ideal e a carga indicada (0 kg para números de fábrica, 90 kg para
testes de revista de época: segundo ocupante e instrumentação).

## Fiat Uno Mille Electronic 1.0 1995

Fiasa 1.0 a gasolina (56 cv, 8,2 kgfm), 5 marchas, tração dianteira. Leve, curto e valente — o menor motor do grid.

- Carroceria: hatch 2 portas, 5 lugares; tração dianteira, motor transversal; pneus 145/80 R13.
- Motor: Fiat 1.0 Fiasa (família 147), SOHC 8V, 994 cm³, taxa 9,5:1, gasolina, carburador (modelo não identificado nas fontes consultadas).
- Câmbio: 3,91 / 2,24 / 1,52 / 1,16 / 0,96; diferencial 4,07.
- Massa no jogo: 923 kg (vazio + piloto 75 kg + combustível); Cx 0,36, área 1,90 m².
- Limite de giro: 6700 rpm; marcha lenta 850 rpm.

Fontes (consultadas em 16/11/2026):

- [Guia Carros — Fiat Uno Mille Electronic 1.0 1995](https://www.guiacarros.com.br/ficha-carro/fiat-uno-mille-electronic-10-1995) — technical-sheet, ano 1995. Gasolina; 830 kg; 145/80 R13; 144 km/h; 0–100 em 18,2 s; Cx 0,36, A 1,9 m². Portas não identificadas.
- [Ficha Completa — Fiat Uno Mille Electronic 1.0 1995 gasolina](https://www.fichacompleta.com.br/carros/fiat/uno-mille-electronic-1-0-1995-gasolina) — technical-sheet, ano 1995. Versão 4 portas: 860 kg; 165/70 R13; 149 km/h. Câmbio C506 (relações não informadas).
- [Oficina Brasil — Fiat Uno Mille ELX (Do fundo do baú)](https://oficinabrasil.com.br/noticia/do-fundo-do-bau/fiat-uno-mille-elx-o-modelo-que-apresentou-ao-brasil-o-conceito-de-city-car-europeu) — literature, ano 1993–1994. 5ª marcha do Electronic: 0,959 (Mille básico: 0,863).
- [VRUM — Ficha técnica Fiat Uno Mille 1.0 Fire](https://correiobraziliense.vrum.com.br/fichatecnica/fiat/uno/2006/001162-2) — technical-sheet, ano 2006. OUTRA VERSÃO (motor Fire): 2ª 2,238, ré 3,909, diferencial 4,067. Usado só como referência da família C506.

## Chevrolet Chevette SL 1.6/S 1988

Sedã de tração traseira com o 1.6/S a etanol (72 cv, 12,3 kgfm). A transferência de carga ajuda na largada.

- Carroceria: sedã 2 portas (três volumes); tração TRASEIRA, eixo rígido, motor longitudinal; pneus 175/70 R13.
- Motor: GM 1.6/S (Chevette) SOHC 8V, 1599 cm³, taxa 11,8:1, etanol hidratado, carburador de corpo simples.
- Câmbio: 3,75 / 2,16 / 1,38 / 1,00 / 0,84; diferencial 3,90.
- Massa no jogo: 1038 kg (vazio + piloto 75 kg + combustível); Cx 0,45, área 1,80 m².
- Limite de giro: 6300 rpm; marcha lenta 900 rpm.

Fontes (consultadas em 16/11/2026):

- [Ficha Completa — Chevette SL/E 1.6 1988 álcool](https://www.fichacompleta.com.br/carros/comparativo/chevette-sl-e-1-6-1988-alcool-vs-chevette-sl-1-6-1986-alcool) — technical-sheet, ano 1988. 72 cv @ 5600; 12,3 kgfm @ 3200; 82,0 × 75,7 mm; 11,8:1; 945 kg; 4193 × 1570 × 1324 mm; entre-eixos 2395; 175/70 R13; 150 km/h; 0–100 16,9 s.
- [JK Carros — Chevette SL/E 1.6/S álcool 1988](https://jkcarros.com.br/?p=9812) — technical-sheet, ano 1988. Divergência: 73 cv @ 5800 e 12,8 kgfm @ 3400.
- [Chevetteiros Curitiba — Dados técnicos do Chevette](http://www.chevetteiroscuritiba.com.br/dadoschevette.htm) — literature, ano 1987–1993. Câmbio de 5 marchas: 3,746 / 2,157 / 1,378 / 1,000 / 0,840, ré 3,815; diferencial 3,90 (sedã/hatch), 4,11 (Chevy 500).

## Chevrolet Celta 1.0 2003

Família I 1.0 VHC com injeção multiponto (70 cv a 6400 rpm), câmbio curto e tração dianteira. Gira alto e sai esperto.

- Carroceria: hatch 2 portas; tração dianteira, motor transversal; pneus 165/70 R13.
- Motor: GM Família I 1.0 VHC 8V, 999 cm³, taxa 12,6:1, gasolina, injeção eletrônica multiponto.
- Câmbio: 4,27 / 2,35 / 1,48 / 1,05 / 0,80; diferencial 4,87.
- Massa no jogo: 959 kg (vazio + piloto 75 kg + combustível); Cx 0,37, área 1,98 m².
- Limite de giro: 6800 rpm; marcha lenta 850 rpm.

Fontes (consultadas em 16/11/2026):

- [Revista Auto — Ficha técnica Chevrolet Celta 1.0 2003](https://revistaauto.com.br/ficha-tecnica-da-chevrolet-celta-1-0-2003/) — technical-sheet, ano 2003. 70 cv @ 6400; 8,8 kgfm @ 3000; 12,6:1; MPFI; 864 kg; 165/70 R13; 155 km/h; 0–100 13,1 s; 2 portas.
- [VRUM — Ficha técnica Chevrolet Celta 1.0 MPFI VHC 8V 2003](https://www.vrum.com.br/fichatecnica/Chevrolet/CELTA/2003/004227-7) — technical-sheet, ano 2003. 71,1 × 62,9 mm; marchas 4,27 / 2,35 / 1,48 / 1,05 / 0,80, ré 3,31; diferencial 4,87.

## Chevrolet Corsa GL 1.4 1996

Família I 1.4 EFI (60 cv, 11,1 kgfm a 2800 rpm): torque cedo, quinta longa, tração dianteira.

- Carroceria: hatch 2 portas; tração dianteira, motor TRANSVERSAL; pneus 145/80 R13.
- Motor: GM Família I 1.4 EFI 8V, 1389 cm³, taxa 9,4:1, gasolina, injeção eletrônica monoponto (EFI).
- Câmbio: 3,55 / 1,96 / 1,30 / 0,89 / 0,71; diferencial 4,53.
- Massa no jogo: 957 kg (vazio + piloto 75 kg + combustível); Cx 0,35, área 1,88 m².
- Limite de giro: 6200 rpm; marcha lenta 850 rpm.

Fontes (consultadas em 16/11/2026):

- [Revista Auto — Ficha técnica Chevrolet Corsa GL 1.4 1996](https://revistaauto.com.br/ficha-tecnica-chevrolet-corsa-gl-1-4-1996/) — technical-sheet, ano 1996. 60 cv @ 5200; 11,1 kgfm @ 2800; 9,4:1; EFI; 865 kg; 145/80 R13; 154 km/h; 0–100 15,5 s; Cx 0,35. Imprime "longitudinal" (divergência).
- [Carros na Web — Chevrolet Corsa GL 1.4 1996](https://www.carrosnaweb.com.br/fichadetalhe.asp?codigo=225) — technical-sheet, ano 1996. Disposição TRANSVERSAL; 77,6 × 73,4 mm; câmbio F13; A 1,88 m²; Cx 0,35.
- [Corsa Clube — Relações câmbio e diferencial Corsa B / Classic](https://corsaclube.com.br/viewtopic.php?t=65878) — forum, ano 1994. Linha "Corsa 1.0 Wind E / 1.4 GL 1994": 3,55 / 1,96 / 1,30 / 0,89 / 0,71, ré 3,31, diferencial 4,53. Não verificado em manual.

## Chevrolet Kadett SL 1.8 1992

Família II 1.8 a gasolina com carburador de corpo duplo (98 cv, 14,6 kgfm). Hatch aerodinâmico (Cx 0,32) e tração dianteira.

- Carroceria: hatch 2 portas; tração dianteira, motor transversal; pneus 165/70 R13.
- Motor: GM Família II 1.8 8V, 1796 cm³, taxa 8,8:1, gasolina, carburador de corpo duplo.
- Câmbio: 3,55 / 2,16 / 1,48 / 1,12 / 0,89; diferencial 3,72.
- Massa no jogo: 1103 kg (vazio + piloto 75 kg + combustível); Cx 0,32, área 1,96 m².
- Limite de giro: 6500 rpm; marcha lenta 850 rpm.
- Tolerância: Divergência não resolvida: 98 cv a 5800 rpm com Cx 0,32 × 1,96 m² fecham o balanço de potência perto de 185–190 km/h, não 167 km/h. Pelo menos um dos três dados da ficha está errado; o torque não foi alterado para esconder isso.

Fontes (consultadas em 16/11/2026):

- [Revista Auto — Ficha técnica Chevrolet Kadett SL 1.8 1992](https://revistaauto.com.br/ficha-tecnica-chevrolet-kadett-sl-1-8-1992/) — technical-sheet, ano 1992. 98 cv @ 5800; 14,6 kgfm @ 3600; 8,8:1; carburador; 1010 kg; 165/70 R13; 167 km/h; 0–100 12,3 s; Cx 0,32; 2 portas.
- [Ficha Completa — comparativos Kadett SL / SL/E 1.8 1992](https://www.fichacompleta.com.br/carros/comparativo/kadett-sl-e-1-8-1992-vs-kadett-sl-e-1-8-at-1992) — technical-sheet, ano 1992. Área frontal 1,96 m²; câmbio manual de 5 marchas, monodisco a seco.
- [Quatro Rodas (citado em fórum) — Kadett GS 1990, relações de marcha](https://forum.monzeiros.com/viewtopic.php?t=552&start=15) — forum, ano 1990. OUTRA VERSÃO (GS 2.0): 3,55 / 2,16 / 1,48 / 1,12 / 0,89, ré 3,33, diferencial 3,72. Relações do SL 1.8 1992 não encontradas.

## Volkswagen Saveiro GL 1.8 1994

Picape AP-1800 a gasolina (88 cv, 14,9 kgfm), original de fábrica. Caçamba vazia: pouco peso sobre o eixo de trás.

- Carroceria: picape cabine simples com caçamba; tração dianteira, motor longitudinal; pneus 175/70 R13.
- Motor: VW AP-1800 (gasolina), 1781 cm³, taxa 8,5:1, gasolina, carburador de corpo duplo.
- Câmbio: 3,46 / 1,94 / 1,29 / 0,97 / 0,80; diferencial 4,11.
- Massa no jogo: 1012 kg (vazio + piloto 75 kg + combustível); Cx 0,52, área 1,90 m².
- Limite de giro: 6300 rpm; marcha lenta 850 rpm.

Fontes (consultadas em 16/11/2026):

- [Guia Carros — Volkswagen Saveiro GL 1.8 1994](https://www.guiacarros.com.br/ficha-carro/volkswagen-saveiro-gl-18-1994) — technical-sheet, ano 1994. AP-1800 gasolina 8,5:1; 88 cv @ 5600; 14,9 kgfm @ 3200; 920 kg; carga útil 580 kg; 4070 × 1622 × 1368 mm; 175/70 R13; 159 km/h; 0–100 11,8 s; Cx 0,52.
- [Volkspage — Ficha técnica Saveiro G3 (transmissão AP 1800)](https://www.volkspage.net/technik/fichas/saveiro_g3.htm) — literature, ano 1998+. OUTRA GERAÇÃO: AP 1800, 38/11 3,455; 35/18 1,944; 36/28 1,286; 31/32 0,969; 28/35 0,800; diferencial 37/9 4,111. Assumido igual na Saveiro 1994 (não verificado).

## Divergências e escolhas

- **VRUM — Ficha técnica Fiat Uno Mille 1.0 Fire**: OUTRA VERSÃO (motor Fire): 2ª 2,238, ré 3,909, diferencial 4,067. Usado só como referência da família C506.
- **Revista Auto — Ficha técnica Chevrolet Corsa GL 1.4 1996**: 60 cv @ 5200; 11,1 kgfm @ 2800; 9,4:1; EFI; 865 kg; 145/80 R13; 154 km/h; 0–100 15,5 s; Cx 0,35. Imprime "longitudinal" (divergência).
- **Corsa Clube — Relações câmbio e diferencial Corsa B / Classic**: Linha "Corsa 1.0 Wind E / 1.4 GL 1994": 3,55 / 1,96 / 1,30 / 0,89 / 0,71, ré 3,31, diferencial 4,53. Não verificado em manual.
- **Quatro Rodas (citado em fórum) — Kadett GS 1990, relações de marcha**: OUTRA VERSÃO (GS 2.0): 3,55 / 2,16 / 1,48 / 1,12 / 0,89, ré 3,33, diferencial 3,72. Relações do SL 1.8 1992 não encontradas.
- **JK Carros — Chevette SL/E 1.6/S álcool 1988**: Divergência: 73 cv @ 5800 e 12,8 kgfm @ 3400.
- **Volkspage — Ficha técnica Saveiro G3 (transmissão AP 1800)**: OUTRA GERAÇÃO: AP 1800, 38/11 3,455; 35/18 1,944; 36/28 1,286; 31/32 0,969; 28/35 0,800; diferencial 37/9 4,111. Assumido igual na Saveiro 1994 (não verificado).

