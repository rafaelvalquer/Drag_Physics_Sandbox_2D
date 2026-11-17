# Relatório de balanceamento — Capítulo 2

Os dados completos, gerados por `npx tsx scripts/balance-chapter2.ts --out docs/chapter2/balance-data.md`, estão em [`balance-data.md`](balance-data.md):

- tabela dos builds preparados;
- ficha de cada rival;
- matriz de 64 combinações carro/build/piloto contra os 10 rivais;
- campanha simulada.

Tudo roda sem interface (`runHeadlessRace`) com as mesmas regras de física, IA e recompensa do jogo. As sementes são fixas, então o relatório é reproduzível.

## Princípios

- **Sem potência artificial.** Rivais e jogador usam o mesmo `resolveBuild` (v2) e as mesmas peças, preços e compatibilidades. A IA não tem multiplicador oculto: a dificuldade de cada rival vem só das peças que ele instalou e do perfil de piloto (tempo de reação, controle de patinagem, ponto de troca), que aparecem na tela do rival.
- **Nenhum torque forçado.** Quando um rival ficou forte ou fraco demais, o ajuste foi trocar as peças instaladas, nunca escalar a curva.

## Builds preparados (pista de testes, piloto avançado)

| Carro | Original (cv / 402 m) | Stage 1 ou remap (cv / 402 m) | Preparado (cv / 402 m) |
|---|---|---|---|
| Astra 2.0 | 140 / 16,70 s | 144 / 16,47 s | 177 / 15,66 s |
| 208 GT | 173 / 15,54 s | 198 / 15,09 s | 217 / 14,81 s |
| Golf GTI | 180 / 15,64 s | 206 / 15,14 s | 225 / 14,73 s |
| A3 1.8T | 180 / 15,74 s | 206 / 15,23 s | 225 / 14,82 s |
| C200 | 184 / 15,52 s | 216 / 14,88 s | 235 / 14,39 s |
| 320i | 184 / 15,36 s | 216 / 14,74 s | 234 / 14,30 s |
| Civic Si | 192 / 15,68 s | 198 / 15,45 s | 240 / 15,00 s |
| Jetta TSI | 200 / 15,14 s | 235 / 14,72 s | 255 / 14,36 s |
| Evo X | 295 / 13,66 s | 336 / 13,08 s | 369 / 12,63 s |
| 335i | 306 / 13,71 s | 352 / 13,32 s | 387 / 12,81 s |

Os ganhos são realistas para cada família:

- Stage 1 em turbo de fábrica: +14 % a +17 %;
- remap em aspirado: +3 %;
- aspirado preparado: +25 %, à custa de torque baixo;
- o turbo híbrido (desbloqueado na etapa 8, exige ECU programável) leva sedãs a 13,7–14,2 s e a 335i a 12,4–12,8 s.

## Escada de rivais (tempo total RT + ET do rival)

| Etapa | Rival | Carro e peças | Tempo típico |
|---|---|---|---|
| 1 | Guga | Astra (filtro, escape) | 11,6 s (201 m) |
| 2 | Camila | 208 GT (pneus) | 11,0 s (201 m) |
| 3 | Ricardo | Golf GTI (Stage 1, embreagem) | ~15,9 s |
| 4 | André | A3 (Stage 1, controle de pressão, embreagem) | ~15,9 s |
| 5 | Helena | C200 (Stage 1) | ~15,3 s |
| 6 | Daniel | 320i (Stage 1, câmbio, suspensão, semi-slick) | 14,9 s |
| 7 | Lucas | Civic Si aspirado preparado | 15,6 s |
| 8 | Felipe | Jetta (Stage 1, DSG, intercooler, escape, semi-slick) | 15,0 s |
| 9 | Bianca | Evo X (ACD, pneus) | 14,2 s |
| 10 | Victor | 335i (Stage 1, câmbio, semi-slick, suspensão) | 13,7 s |

A etapa 7 fica de propósito um pouco abaixo da 6. É a corrida do aspirado: ela premia quem chega com qualquer turbo preparado e serve de respiro antes do Corredor da Liga.

## Ajustes feitos nesta rodada

1. **Prêmios.** Passaram de 45.500 para 81.500 CR no total (2.500 / 3.500 / 4.500 / 5.500 / 6.500 / 7.500 / 8.500 / 10.000 / 13.000 / 20.000).
   - Os preços da revenda são os do plano e não mudaram.
   - O plano pede que "o preço do Evo e da 335i" seja "equilibrado com os ganhos". Com os prêmios antigos, nenhuma rota fechava o capítulo em 160 corridas: a simulação acumulava dinheiro só com repetições pagas, a 35 % do prêmio.
2. **Ricardo e André mais leves.** Saíram o intercooler e o escape do Golf, e o intercooler do A3.
   - Antes, os dois corriam a ~15,7 s e só um carro todo preparado com piloto avançado os vencia.
   - Agora correm a ~15,9 s: o 208, o Golf ou o A3 preparados vencem com piloto intermediário, e com Stage 1 ficam a ~0,2 s.
3. **Helena** perdeu o upgrade do câmbio automático e ficou só com Stage 1. Antes a etapa 5 era mais difícil que a 6 e a 7.
4. **Evo X de série.** O ganho de turbo do áudio caiu de 0,78 para 0,48. Isso é só som, sem efeito no desempenho; ver `audio-calibration.md`.

## Campanha simulada

Ponto de partida:

- capítulo 1 concluído com o Gol turbo;
- 4.000 CR e 200 de reputação;
- limite de 160 corridas.

O jogador simulado:

- compra o próximo carro da rota quando perde duas vezes seguidas, se tiver o preço mais 3.000 CR de reserva;
- vende o carro do capítulo 2 anterior a 60 %;
- compra peças por prioridade (só as compatíveis e desbloqueadas);
- intercala tentativas no evento pendente com repetições do evento mais bem pago que o carro atual venceu por último.

| Rota | Piloto | Corridas | Derrotas | Concluiu |
|---|---|---:|---:|---|
| Gol → Golf → 320i → Evo | intermediário | 66 | 29 | sim |
| Gol → Golf → 320i → Evo | avançado | 75 | 33 | sim |
| 208 → C200 → Evo | intermediário | 150 | 71 | sim (longo: muitas tentativas contra Bianca antes de juntar para o Evo) |
| 208 → C200 → Evo | avançado | 74 | 32 | sim |
| Astra → Golf → Civic | intermediário/avançado | 160 | ~80 | **não**: para na etapa 5 |

### Leitura dos resultados

- **O capítulo pode ser concluído** com um piloto intermediário em cerca de 65 a 75 corridas na rota sensata. Mais ou menos metade delas são repetições pagas e tentativas.
- **O desafio final pede o Evo X preparado, ou a 335i com turbo híbrido.**
  - Na matriz, só o Evo preparado vence Victor com piloto intermediário (13,3 s contra 13,7 s); o Evo Stage 1 vence só com piloto avançado, por 0,06 s. O turbo híbrido (12,4–12,8 s na 335i, medido na calibração) é a outra saída.
  - A 335i de série perde de Victor (mesmo carro, Stage 1). Ela é vendida só depois da etapa 10, como recompensa de uso livre, conforme o plano.
  - O carro do capítulo 1 não chega lá: o Gol turbo vence as etapas 1 e 2 e nenhuma outra.
  - Por isso, "o jogador não precisa obrigatoriamente comprar um carro novo" vale para o começo do capítulo, mas não para o fim. Fazer o Gol vencer a Liga exigiria potência fora da física das peças, o que o próprio plano proíbe.
- **O Civic Si é um carro de coleção e da etapa 7, não da campanha inteira.**
  - Mesmo aspirado preparado (240 cv), ele perde da C200 Stage 1 (16,1 × 15,3 s com piloto intermediário).
  - Quem escolhe a rota do Civic precisa trocar para um turbo (C200, 320i ou Jetta, todos disponíveis por reputação nessa altura) para seguir.
  - A tela de compra mostra cavalos e tração antes da compra, e o resultado de cada corrida mostra a diferença de tempo, então o jogador não fica sem informação. A trava, porém, é real e está registrada aqui.
- **A reputação abre a revenda na hora certa.**
  - Ao fim da etapa 4, o jogador tem ~290 de reputação: C200 (260) e 320i (280) liberadas, Jetta (320) ainda não.
  - Depois da etapa 8, tem ~460: o Evo (400) está liberado para Bianca e Victor.
