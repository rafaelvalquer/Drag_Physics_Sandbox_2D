# Relatório de balanceamento — Capítulo 3

Dados completos, gerados por `npx tsx scripts/balance-chapter3.ts --out docs/chapter3/balance-data.md`: [`balance-data.md`](balance-data.md) (tabela de builds, ficha dos dez rivais e a matriz de corridas de 27 builds × 2 pilotos contra os dez rivais). Tudo roda sem interface (`runHeadlessRace`) com as mesmas regras de física, IA e recompensa do jogo e sementes fixas, então o relatório é reproduzível.

## Princípios

- **Sem potência artificial.** Rivais e jogador usam o mesmo `resolveBuild` (v2). Os oito carros novos dos rivais são o carro **de fábrica** (o teste confere que o build dos rivais sem peças tem exatamente a potência e o torque de fábrica). A dificuldade vem do carro, das peças e do piloto (reação, controle de patinação, ponto de troca), tudo exibido na tela do rival.
- **Nenhum torque forçado** e nenhum multiplicador oculto de IA.

## Os dez rivais, na ordem real de dificuldade

O plano propôs uma ordem; o próprio plano manda "ajustar a sequência dos eventos e as configurações dos rivais" se um carro quebrar a ordem de dificuldade. Com os tempos simulados, a ordem proposta quebrava em quatro pontos (o Golf Stage 2, terceiro, é mais lento que a 350Z e a IS 350 que o antecedem; o Stinger, sexto, é mais fácil que o C 43, quinto; a Ghibli, oitava, é mais fácil que a Evo, sétima). A sequência abaixo é a do tempo de 402 m de cada rival na pista de testes (estritamente decrescente):

| # | Duelo | Rival | Carro e preparação | cv / N·m | 0–100 | 402 m |
|---|---|---|---|---|---|---|
| 1 | A Volta do GTI (201 m) | Ricardo | Golf GTI **Stage 2** (remap, downpipe, intercooler, admissão direta, forjados, embreagem, slick, suspensão, alívio de peso, volante, diferencial) | 230 / 301 | 5,86 s | 14,21 s |
| 2 | Primeira Elite (201 m) | Hugo | 350Z de fábrica | 304 / 353 | 5,79 s | 14,10 s |
| 3 | Silêncio Refinado | Renata | IS 350 de fábrica | 312 / 376 | 5,93 s | 14,07 s |
| 4 | Zeta de Verdade | Bruno | 370Z de fábrica | 337 / 366 | 5,34 s | 13,63 s |
| 5 | Peso Pesado | Davi | Stinger GT de fábrica | 370 / 510 | 4,88 s | 13,13 s |
| 6 | Salão Italiano | Valentina | Ghibli S Q4 de fábrica | 410 / 551 | 4,58 s | 12,79 s |
| 7 | Biturbo Alemão | Maya | C 43 de fábrica | 367 / 521 | 4,33 s | 12,61 s |
| 8 | A Volta da Evo | Bianca | Evo X **preparado** (ECU programável, turbina híbrida, forjados, intercooler, controle de pressão, SST, diferencial central, slick, suspensão) | 391 / 476 | 3,94 s | 12,19 s |
| 9 | O Trevo Vermelho | Dante | Giulia QV de fábrica | 512 / 601 | 4,09 s | 11,85 s |
| 10 | Elite da Madrugada | Akira | GT-R de fábrica, piloto de elite | 553 / 628 | 3,50 s | 11,51 s |

Os dois que voltam do capítulo 2 estão claramente acima das versões originais, com peças que existem na oficina: o Golf de Ricardo vai de 180 cv e 235 N·m (15,64 s) a 230 cv e 301 N·m (14,21 s); o Evo de Bianca vai de 295 cv e 366 N·m (13,66 s) a 391 cv e 476 N·m (12,19 s). O Golf não passa de Stage 2 porque a turbina híbrida exige ECU programável e o Stage 2 é um mapa fechado (sem a turbina, o Stage 3 chegaria a 13,75 s, mas o plano pede Stage 2). O que o Golf tem de mais forte é o piloto: o tempo de reação de Ricardo (0,19 s) é o mais baixo dos quatro primeiros.

Os eventos 1 e 2 são de 201 m e os demais de 402 m, como no plano. Prêmios: 15, 20, 26, 32, 40, 48, 60, 75, 95 e 150 mil CR (561 mil no total); reputação: 50, 55, 60, 65, 70, 75, 80, 90, 100 e 120 (765 no total).

## Builds dos oito carros

| Carro | Original | Stage 1 ou primeiros upgrades | Preparado | 402 m (orig → prep.) |
|---|---|---|---|---|
| 350Z | 304 cv | 304 cv (pneus + embreagem) | 312 cv | 14,10 → 13,55 s |
| IS 350 | 312 cv | 312 cv (pneus) | 323 cv | 14,07 → 13,35 s |
| 370Z | 337 cv | 337 cv (pneus + embreagem) | 345 cv | 13,63 → 13,16 s |
| C 43 | 367 cv | 417 cv (Stage 1, 1,20 bar) | 468 cv (Stage 2, 1,45 bar) | 12,61 → 11,53 s |
| Stinger GT | 370 cv | 430 cv | 474 cv | 13,13 → 11,90 s |
| Ghibli S Q4 | 410 cv | 464 cv | 522 cv | 12,79 → 11,61 s |
| Giulia QV | 512 cv | 576 cv | 655 cv | 11,85 → 10,50 s |
| GT-R | 553 cv | 630 cv | 707 cv | 11,51 → 10,39 s |

Os V6 aspirados só têm peças genéricas (sem remap nem turbo, como manda o plano): ganham no máximo ≈ 3 % de potência (alívio de peso, volante, escape) e o resto do tempo vem de pneu, embreagem e peso. Os biturbo têm toda a árvore de turbo: +13 % de potência no Stage 1 e +27 a +28 % no Stage 2, cada mapa recusado pelo resolvedor se faltar o hardware (testado).

## Matriz de corridas (resumo)

Vitórias contra os dez rivais, em ordem (`V` = ganha). Dados completos em `balance-data.md`.

| Carro do jogador | Piloto intermediário | Piloto avançado |
|---|---|---|
| Evo X preparado do cap. 2 | 1–5 | 1–6 |
| 335i do Victor (prêmio do cap. 2) | 1–5 | 1–5 |
| Saveiro do Marcos (prêmio do cap. 1) | nenhuma | nenhuma |
| 350Z / IS 350 / 370Z de fábrica | 0–2 (só o 370Z vence) | 1–3, 1–3 e 1–4 |
| 350Z / IS 350 / 370Z preparados | até 4 (a IS 350 só com o avançado) | até 4 |
| C 43 de fábrica | 1–6 | 1–6 |
| C 43 Stage 1 | 1–8 | 1–8 |
| C 43 Stage 2 preparado | **1–10** | **1–10** |
| Stinger, Ghibli, Giulia de fábrica | 1–4 / 1–5 e 8 / 1–8 | 1–5 / 1–6 / 1–8 |
| Stinger e Ghibli Stage 2 | 1–9 / 1–10 | 1–10 / 1–10 |
| Giulia Stage 1 / Stage 2 | 1–8 / 1–10 | 1–10 / 1–10 |
| GT-R de fábrica / Stage 1 / Stage 2 | 1–8 / 1–10 / 1–10 | 1–9 / 1–10 / 1–10 |

Leitura:
- **O capítulo se conclui.** Com o piloto intermediário, qualquer biturbo com Stage 2 vence os dez (o C 43 é o mais barato: 105.000 + 28.600 CR). O Stage 1 do GT-R basta com os dois pilotos e o do Giulia com o avançado.
- **O chefe pede um carro preparado.** O Akira vence todos os carros de fábrica do jogador, inclusive o próprio GT-R de fábrica pilotado pelo avançado (que ganha 1–9 e perde o 10). É a regra que o plano pede (o GT-R "não ganha aceleração artificial": a vantagem dele é a combinação de motor, câmbio e tração, mais um piloto melhor).
- **Os carros do capítulo 2 acompanham o começo, mas não o fim.** O Evo preparado do capítulo 2 chega até o 5.º ou 6.º duelo, então o jogador precisa comprar e preparar um carro Elite: o capítulo cumpre o papel de "novo patamar".
- **O prêmio do capítulo 1 não distorce nada.** A Saveiro do Marcos (a do Marcos, turbo) não vence nenhum rival do capítulo 3.
- **Os V6 aspirados são carros de entrada e de coleção**, não da campanha inteira: custam 45–70 mil CR, abrem a Elite, mas não passam do 4.º duelo mesmo preparados. É o resultado físico, sem ajuste.

## Economia e revenda

| Carro | Preço (CR) | Reputação | Quando abre (caminho mínimo, ≥ 600 de reputação ao entrar) |
|---|---|---|---|
| Nissan 350Z | 45.000 | 600 | desde o 1.º duelo |
| Lexus IS 350 | 58.000 | 650 | depois do 1.º duelo |
| Nissan 370Z | 70.000 | 720 | depois do 3.º |
| Mercedes-AMG C 43 | 105.000 | 810 | depois do 4.º |
| Kia Stinger GT | 115.000 | 890 | depois do 5.º |
| Maserati Ghibli S Q4 | 145.000 | 970 | depois do 6.º |
| Alfa Romeo Giulia QV | 190.000 | 1.090 | depois do 8.º |
| Nissan GT-R | 250.000 | 1.230 + desbloqueio `c3-dealer-gtr` | depois do 9.º duelo |

- A reputação mínima que o capítulo 2 deixa (200 do capítulo 1 + 400 das primeiras vitórias do capítulo 2) já abre o carro mais barato; cada duelo abre o seguinte, com a reputação que o caminho mínimo acumula (`chapter3.test.ts` confere que a 350Z está disponível ao entrar e que o GT-R só abre depois do 9.º duelo).
- Os prêmios dos quatro primeiros duelos (93 mil CR) já pagam a 350Z; os cinco primeiros somam 133 mil CR, o que cobre o C 43 (105.000) mais o Stage 2 (28.600): o caminho "Evo do capítulo 2 até o 5.º duelo, depois C 43 Stage 2" fecha o capítulo sem repetir corrida. O jogador não é obrigado a comprar carro (o Evo preparado chega ao 5.º ou 6.º duelo), mas para o 7.º em diante precisa de um carro mais forte.
- O GT-R de série só abre depois do 9.º duelo (preço 250.000); o do Akira vem como prêmio do 10.º. A revenda segue a regra de um por modelo, e o prêmio entra mesmo assim (é o prêmio da vitória). Vender qualquer um rende 60 % do preço de tabela (GT-R 150.000 CR; a 350Z comprada por 45.000 rende 27.000).

## Limitações

- **Não foi feita uma simulação de campanha completa** (compra de peças e de carros por estratégia, com repetição de duelos perdidos) como a do capítulo 2. A economia acima foi conferida por conta (preços, prêmios e reputação) e pelos tempos da matriz; um jogador real pode precisar de algumas repetições pagas (35 % do prêmio) em corridas perdidas.
- A matriz usa só os dois níveis de piloto da IA (intermediário e avançado). A margem entre carros muito próximos (por exemplo C 43 de fábrica contra Maya) muda com a semente.
- Os 0–100 de C 43 e Stinger ficam 10 % abaixo do declarado pelos fabricantes e o GT-R 17 % acima do estimado (ver `mechanical-calibration.md`): os rivais herdam esses números da física, não de ajustes.
