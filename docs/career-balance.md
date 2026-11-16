# Balanceamento do Capítulo 1

Saída de `npx tsx scripts/balance-career.ts` (sementes fixas: o resultado é repetível). Pilotos são perfis do
DragAI (`beginner`, `intermediate`, `advanced`); rivais usam o perfil próprio de cada um. Tempo total = RT + ET.
Na física do jogo o RT inclui o rollout até sair do feixe (≈ 0,5 s), por isso os tempos de reação ficam perto de
0,7–1,2 s.

## Conclusões

- **Gol GTS (800 CR):** conclui o capítulo com piloto intermediário ou avançado em 12–13 corridas, sem grind.
- **Chevette (1.400 CR) e Uno (2.200 CR):** vencem as noites 1–3 (o Chevette também a 4 com peças), mas **não
  vencem as noites 5 e 6 só com peças aspiradas**: o Chevette aspirado completo faz ≈ 18,9 s e o Uno ≈ 19,3 s
  contra 17,3–17,6 s do Gol do Léo e do Kadett da Paula. O kit turbo, que resolveria o Chevette (155 cv a 1,0 bar
  vence todos os rivais, inclusive o Marcos), só é liberado depois da noite 6, como pede o roteiro.
- O Uno com turbo a 1,0 bar chega a 98 cv e ainda perde ≈ 1,3 s para a Saveiro turbo do Marcos (141 cv).
- O caminho honesto que existe hoje: os **classificados** vendem o Gol por 800 CR; a simulação compra o Gol depois
  de três derrotas seguidas sem peças a comprar. Assim Chevette e Uno concluem em 32–38 corridas, ≈ 20 delas
  repetições pagas de noites já vencidas — grind alto.
- Piloto iniciante não conclui com nenhum carro (para na noite 6).

Fazer o Uno vencer o Marcos com a Saveiro turbo do roteiro exigiria potência artificial ou um piloto rival
caricato, o que as regras proíbem. Alternativas para decidir:

1. liberar o kit turbo antes (por exemplo na noite 4), mantendo preços e builds;
2. rivais das noites 4–6 com builds mais leves (o roteiro só fixa as peças da Paula e do Marcos);
3. corrida com handicap (largada escalonada por tempo de índice, como no *bracket racing*), que torna qualquer
   carro competitivo sem tocar na física;
4. aceitar o caminho pelos classificados como está.

## Matriz

Sementes: jogador 1000 + i, rival 2000 + i, corrida 3000 + i. Pista e distância do evento.

### Rivais

- 1. Primeira Noite — Lara "Faísca": Chevrolet Celta 1.0 2003, 70 cv, 86 N·m, peças [], RT médio 0.36 s
- 2. O Pequeno Valente — Eduardo "Duda Mille": Fiat Uno Mille Electronic 1.0 1995, 56 cv, 80 N·m, peças [], RT médio 0.3 s
- 3. Acerto de Contas — Roberto "Beto Relógio": Chevrolet Corsa GL 1.4 1996 (preparado), 64 cv, 111 N·m, peças [filter-sport, exhaust-sport], RT médio 0.24 s
- 4. Tração Traseira — Fernando "Nando": Chevrolet Chevette SL 1.6/S 1988 (preparado), 79 cv, 124 N·m, peças [filter-sport, exhaust-sport, manifold-sport, tires-sport], RT médio 0.24 s
- 5. Respeita o AP — Leonardo "Léo AP": Volkswagen Gol GTS 1988 — AP 1.8S Original (preparado), 105 cv, 149 N·m, peças [filter-sport, exhaust-sport, tires-sport], RT médio 0.2 s
- 6. O Aspirado — Paula "Giro": Chevrolet Kadett SL 1.8 1992 (preparado), 116 cv, 152 N·m, peças [filter-sport, manifold-sport, cam-sport, exhaust-sport, tires-sport], RT médio 0.19 s
- 7. Rei da Madrugada — Marcos "Rei da Madrugada": Volkswagen Saveiro GL 1.8 1994 (preparado), 141 cv, 217 N·m, peças [turbo-basic, manifold-sport, exhaust-sport, clutch-reinforced, tires-sport], RT médio 0.18 s

### Carros do jogador

| carro | nível | custo | cv | N·m | 0–100 | 201 m | 402 m | vel. 402 m | patinagem | 1ª troca |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| vw-gol-gts-1988 | original | 0 | 99 | 146 | 9.91 | 11.18 | 17.20 | — | 1.89 s | 6320 |
| vw-gol-gts-1988 | básico | 2350 | 108 | 153 | 9.28 | 10.97 | 16.83 | — | 1.53 s | 6325 |
| vw-gol-gts-1988 | avançado | 8750 | 174 | 231 | 7.04 | 10.04 | 15.10 | — | 2.26 s | 6729 |
| gm-chevette-sl-1988 | original | 0 | 72 | 121 | 13.45 | 12.09 | 18.89 | — | 1.21 s | 6119 |
| gm-chevette-sl-1988 | básico | 2350 | 79 | 124 | 12.35 | 11.76 | 18.37 | — | 0.34 s | 6118 |
| gm-chevette-sl-1988 | avançado | 8750 | 155 | 219 | 7.33 | 10.05 | 15.42 | — | 0.55 s | 6529 |
| fiat-uno-mille-1995 | original | 0 | 56 | 80 | 15.16 | 12.60 | 19.68 | — | 0.27 s | 6515 |
| fiat-uno-mille-1995 | básico | 2350 | 61 | 84 | 13.97 | 12.31 | 19.21 | — | 0.18 s | 6518 |
| fiat-uno-mille-1995 | avançado | 9950 | 98 | 125 | 9.43 | 11.11 | 17.04 | — | 0.31 s | 6931 |

### Corridas (total = RT + ET, s; V = jogador vence)

| carro | nível | piloto | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|---|
| vw-gol-gts-1988 | original | beginner | V 12.24/13.32 | V 12.39/13.32 | V 12.40/12.97 | V 18.47/19.09 | · 18.04/17.57 | · 18.44/17.36 | · 17.73/16.51 |
| vw-gol-gts-1988 | original | intermediate | V 12.07/13.48 | V 11.92/13.28 | V 12.00/12.90 | V 17.98/19.00 | · 17.88/17.60 | · 18.01/17.37 | · 17.84/16.46 |
| vw-gol-gts-1988 | original | advanced | V 11.83/13.56 | V 11.78/13.37 | V 11.79/12.99 | V 17.85/18.93 | · 17.73/17.56 | · 17.74/17.33 | · 17.73/16.47 |
| vw-gol-gts-1988 | básico | beginner | V 12.13/13.46 | V 12.10/13.38 | V 12.22/12.90 | V 18.12/19.01 | · 17.96/17.62 | · 17.59/17.35 | · 18.01/16.51 |
| vw-gol-gts-1988 | básico | intermediate | V 11.78/13.30 | V 11.82/13.28 | V 11.71/12.99 | V 17.73/19.07 | · 17.59/17.52 | · 17.51/17.37 | · 17.50/16.43 |
| vw-gol-gts-1988 | básico | advanced | V 11.60/13.44 | V 11.58/13.25 | V 11.53/12.97 | V 17.53/19.05 | V 17.39/17.61 | V 17.32/17.36 | · 17.38/16.50 |
| vw-gol-gts-1988 | avançado | beginner | V 12.11/13.47 | V 11.80/13.39 | V 11.51/12.97 | V 16.57/19.03 | V 17.05/17.58 | V 16.84/17.33 | · 16.69/16.43 |
| vw-gol-gts-1988 | avançado | intermediate | V 11.08/13.35 | V 11.14/13.33 | V 11.01/12.96 | V 16.11/19.04 | V 15.88/17.60 | V 16.02/17.36 | V 15.90/16.43 |
| vw-gol-gts-1988 | avançado | advanced | V 10.94/13.28 | V 10.88/13.31 | V 10.88/12.98 | V 15.99/19.01 | V 15.90/17.59 | V 15.85/17.35 | V 15.82/16.48 |
| gm-chevette-sl-1988 | original | beginner | V 12.74/13.42 | V 13.10/13.30 | · 13.05/12.89 | · 20.17/19.04 | · 19.63/17.59 | · 19.72/17.39 | · 19.65/16.51 |
| gm-chevette-sl-1988 | original | intermediate | V 12.71/13.35 | V 12.63/13.29 | V 12.73/12.99 | · 19.57/19.06 | · 19.87/17.56 | · 19.97/17.32 | · 19.88/16.48 |
| gm-chevette-sl-1988 | original | advanced | V 12.72/13.46 | V 12.75/13.34 | V 12.69/12.98 | · 19.54/19.03 | · 19.44/17.53 | · 19.43/17.39 | · 19.44/16.47 |
| gm-chevette-sl-1988 | básico | beginner | V 12.71/13.30 | V 12.88/13.36 | V 12.65/12.97 | · 19.27/19.11 | · 19.49/17.58 | · 19.27/17.31 | · 19.73/16.45 |
| gm-chevette-sl-1988 | básico | intermediate | V 12.32/13.37 | V 12.73/13.38 | V 12.54/12.97 | · 19.35/19.05 | · 19.01/17.56 | · 19.02/17.30 | · 19.02/16.46 |
| gm-chevette-sl-1988 | básico | advanced | V 12.53/13.37 | V 12.49/13.25 | V 12.38/12.90 | · 19.09/18.97 | · 18.96/17.54 | · 18.94/17.34 | · 18.99/16.47 |
| gm-chevette-sl-1988 | avançado | beginner | V 11.77/13.39 | V 11.56/13.27 | V 11.10/12.99 | V 16.43/19.00 | V 16.68/17.61 | V 16.40/17.38 | · 16.63/16.46 |
| gm-chevette-sl-1988 | avançado | intermediate | V 10.99/13.34 | V 10.95/13.31 | V 10.83/12.98 | V 16.27/19.01 | V 16.20/17.54 | V 16.22/17.31 | V 16.23/16.46 |
| gm-chevette-sl-1988 | avançado | advanced | V 10.84/13.52 | V 10.82/13.31 | V 10.81/12.96 | V 16.22/19.04 | V 16.13/17.59 | V 16.14/17.31 | V 16.09/16.45 |
| fiat-uno-mille-1995 | original | beginner | V 13.35/13.50 | V 13.31/13.35 | · 13.55/12.99 | · 20.75/19.03 | · 20.64/17.56 | · 20.84/17.37 | · 20.61/16.50 |
| fiat-uno-mille-1995 | original | intermediate | V 13.34/13.44 | V 13.18/13.25 | · 13.24/12.98 | · 20.46/18.98 | · 20.42/17.56 | · 20.44/17.41 | · 20.37/16.47 |
| fiat-uno-mille-1995 | original | advanced | V 13.17/13.30 | V 13.17/13.27 | · 13.20/12.98 | · 20.30/18.99 | · 20.21/17.62 | · 20.23/17.37 | · 20.18/16.45 |
| fiat-uno-mille-1995 | básico | beginner | V 13.43/13.45 | V 13.27/13.36 | · 13.20/12.97 | · 20.41/18.95 | · 20.61/17.56 | · 20.43/17.35 | · 19.84/16.50 |
| fiat-uno-mille-1995 | básico | intermediate | V 13.07/13.40 | V 12.94/13.32 | V 12.97/12.99 | · 20.04/19.08 | · 19.85/17.54 | · 19.90/17.38 | · 19.94/16.45 |
| fiat-uno-mille-1995 | básico | advanced | V 12.87/13.48 | V 12.91/13.37 | V 12.86/12.98 | · 19.84/19.08 | · 19.70/17.57 | · 19.71/17.33 | · 19.72/16.51 |
| fiat-uno-mille-1995 | avançado | beginner | V 11.98/13.16 | V 12.29/13.27 | V 12.04/12.91 | V 18.43/19.08 | · 18.09/17.54 | · 18.20/17.38 | · 18.35/16.46 |
| fiat-uno-mille-1995 | avançado | intermediate | V 11.97/13.44 | V 11.83/13.35 | V 11.89/12.99 | V 17.86/19.02 | · 17.85/17.53 | · 17.89/17.33 | · 17.92/16.50 |
| fiat-uno-mille-1995 | avançado | advanced | V 11.84/13.46 | V 11.86/13.36 | V 11.82/12.98 | V 17.82/18.95 | · 17.80/17.60 | · 17.79/17.35 | · 17.78/16.47 |

### Campanha simulada (compras por prioridade, revanche até vencer, limite de 40 corridas)

| carro inicial | piloto | corridas | derrotas | repetições pagas | créditos finais | concluiu | parou em |
|---|---|---:|---:|---:|---:|---|---|
| vw-gol-gts-1988 | beginner | 40 | 35 | 0 | 4550 | não | 6. O Aspirado (6 peças) |
| vw-gol-gts-1988 | intermediate | 13 | 2 | 4 | 2850 | sim | — |
| vw-gol-gts-1988 | advanced | 12 | 1 | 4 | 2750 | sim | — |
| gm-chevette-sl-1988 → Gol na corrida 9 | beginner | 40 | 22 | 13 | 1320 | não | 6. O Aspirado (6 peças) |
| gm-chevette-sl-1988 → Gol na corrida 8 | intermediate | 36 | 10 | 19 | 2640 | sim | — |
| gm-chevette-sl-1988 → Gol na corrida 8 | advanced | 32 | 5 | 20 | 2590 | sim | — |
| fiat-uno-mille-1995 → Gol na corrida 8 | beginner | 40 | 25 | 10 | 1560 | não | 6. O Aspirado (6 peças) |
| fiat-uno-mille-1995 → Gol na corrida 10 | intermediate | 38 | 13 | 18 | 2620 | sim | — |
| fiat-uno-mille-1995 → Gol na corrida 10 | advanced | 34 | 8 | 19 | 2590 | sim | — |
