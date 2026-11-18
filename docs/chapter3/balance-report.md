# Relatório de balanceamento — Capítulo 3 (P1: rivais preparados e corridas de 1 km)

Dados completos, gerados por `npx tsx scripts/balance-chapter3.ts --out docs/chapter3/balance-data.md`: [`balance-data.md`](balance-data.md) (builds de referência e do capítulo com 0–100, 201/402/1000 m e velocidade, ficha dos dez rivais e a matriz de corridas com três pilotos e três sementes por duelo). Tudo roda sem interface (`runHeadlessRace`) com as mesmas regras de física, IA e recompensa do jogo, então o relatório é reproduzível. Nenhum save é lido ou alterado: todos os carros saem do catálogo.

## Diagnóstico (antes da P1)

Com os oito rivais novos de fábrica, um **335i Stage 3** (489 cv, 629 N·m, 402 m em 11,62 s, 1000 m em 20,72 s) vencia 9 dos 10 duelos com o piloto intermediário e 10 de 10 com o avançado. O Stage 2 (391 cv) vencia 6 e 8 e o original, 3. O capítulo era fácil demais para quem chegava com o 335i do capítulo 2.

## Princípios

- **Sem potência artificial.** Rivais e jogador usam o mesmo `resolveBuild` (v2). O teste `chapter3.test.ts` confere que a potência, o torque e a massa de cada rival são exatamente os que o resolvedor produz a partir das mesmas peças e do mesmo ajuste. Não há multiplicador oculto, torque forçado, aceleração forçada nem resistência infinita do motor; o rival do 1 km usa o mesmo Blown Engine da família do motor.
- **Nenhuma peça exclusiva de rival.** Todas as peças dos rivais existem no catálogo e a compatibilidade (`incompatibility`) vale para eles como para o jogador.
- A dificuldade vem do carro, das peças, do ajuste e do piloto, tudo exibido na tela do rival (potência, torque, aspiração, nível de preparo, peças e distância).

## Peças novas dos V6 aspirados

Os V6 aspirados tinham só peças genéricas. Foram criadas cinco peças, todas com efeito físico no modelo de respiração (restrição, eventos de válvula, ignição, capacidade de fluxo), por família, liberadas ao fim do 1.º duelo (`c3-v6-parts`) e disponíveis ao jogador:

| Peça | Famílias | Preço (CR) | Efeito |
|---|---|---:|---|
| Admissão V6 de alto fluxo | VQ35DE, VQ37VHR, 2GR-FSE | 1.100 | queda de pressão da admissão 0,7 kPa |
| Escape esportivo V6 | as três | 2.200 | contrapressão 5 kPa, geometria e som |
| Remap aspirado V6 | as três | 2.400 | ignição e corte de giro +200 rpm |
| Comandos VQ35DE Stage 1 | VQ35DE | 2.800 | duração, cruzamento e levantamento |
| Comandos VQ37VHR Stage 1 | VQ37VHR | 3.200 | idem, ganho menor (VVEL) |
| Cabeçotes V6 retrabalhados | VQ35DE, VQ37VHR | 4.600 | fluxo +5 % |

O 2GR-FSE (IS 350) só recebe admissão, escape e remap: a seleção conservadora. Um 350Z passa de 304 cv a 323 cv com admissão, escape e remap, 335 cv com os comandos e 357 cv com os cabeçotes; nenhum chega perto de um turbo.

## Os dez rivais — antes e depois

| # | Duelo (distância) | Rival | Antes (cv, 402 m) | Depois (cv, 402 m / 1000 m) | Preparação |
|---|---|---|---|---|---|
| 1 | A Volta do GTI (201 m) | Ricardo | 230, 14,21 s | 230, 14,21 s / 25,54 s | Golf Stage 2 (inalterado) |
| 2 | Primeira Elite (201 m) | Hugo | 304, 14,10 s | 323, 13,33 s / 23,85 s | 350Z: admissão, escape, remap, embreagem, slick, diferencial, peso, suspensão |
| 3 | Silêncio Refinado (402 m) | Renata | 312, 14,07 s | 333, 12,95 s / 23,42 s | IS 350: admissão, escape, remap, câmbio, slick, diferencial, peso, suspensão |
| 4 | Zeta de Verdade (402 m) | Bruno | 337, 13,63 s | 367, 12,84 s / 22,88 s | 370Z: admissão, escape, remap, comandos, embreagem, slick, diferencial, peso, suspensão |
| 5 | Peso Pesado (402 m) | Davi | 370, 13,13 s | 439, 12,32 s | Stinger Stage 1 + admissão direta, câmbio, semi-slick, AWD, suspensão |
| 6 | Salão Italiano (**1 km**) | Valentina | 410, 12,79 s | 522, 11,60 s / 21,01 s | Ghibli Stage 2 completo |
| 7 | Biturbo Alemão (402 m) | Maya | 367, 12,61 s | 468, 11,62 s | C 43 Stage 2 completo |
| 8 | A Volta da Evo (**1 km**) | Bianca | 391, 12,19 s | 452, 11,70 s / 21,33 s | Evo X Stage 3 (turbina híbrida, ECU Stage 3, forjados, DCT, AWD, slick) |
| 9 | O Trevo Vermelho (402 m) | Dante | 512, 11,85 s | 655, 10,50 s | Giulia Stage 2 completo |
| 10 | Elite da Madrugada (**1 km**) | Akira | 553, 11,51 s | 707, 10,39 s / 18,96 s | GT-R Stage 2 completo (dupla embreagem, AWD, slick) |

Os eventos mantêm os IDs e a ordem. O GT-R do prêmio é a cópia do build do Akira (Stage 2), entregue uma vez; um GT-R já recebido no save não é alterado (o prêmio é um carro do jogador, com as peças gravadas na entrega).

## Dificuldade para um 335i preparado

Vitórias do jogador contra os duelos 1–10 (3 sementes, os três pilotos dão o mesmo resultado para o 335i):

| 335i | Duelos vencidos |
|---|---|
| original | 1 |
| Stage 1 / Stage 2 | 1–4 |
| Stage 3 (489 cv) | 1–6 e 8; perde o 7, o 9 e o 10 |

Metas do plano: 1–3 acessíveis (sim), 4–5 competitivos (o 5 só com o Stage 3), 6–8 pedem bom acerto e pilotagem (o 7, Maya, é o mais duro do grupo: a C 43 de tração integral com 468 cv iguala o 335i de 489 cv), 9 alto e 10 máximo (nenhuma versão do 335i vence).

## Caminhos viáveis para fechar o capítulo

Piloto humano (reação 0,22 s, trocas ±90 rpm), 5 sementes nos duelos 6–10:

| Carro (Stage 3 completo) | cv | 6 | 7 | 8 | 9 | 10 |
|---|---:|---|---|---|---|---|
| Giulia QV | 767 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| GT-R | 871 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| C 43 | 577 | 5/5 | 5/5 | 5/5 | 0/5 | 0/5 |

Com o Stage 2: a Giulia vence 1–8 (e às vezes o 9) e o GT-R vence 1–9 com os três pilotos e o 10 em 1/3 das sementes com o piloto avançado. Portanto há **dois caminhos** com carros da economia normal: **Giulia Stage 3** (190 mil CR do carro, abre depois do 8.º duelo) e **GT-R Stage 2/3** (250 mil CR, abre depois do 9.º). O C 43 Stage 3 chega ao 8.º duelo. Nenhuma compra é obrigatória antes do 5.º duelo, e os preços das peças não foram alterados.

## Limitações

- A simulação é determinista: os três pilotos produzem resultados muito próximos para a mesma sequência de sementes; a diferença entre intermediário, avançado e humano aparece só nos duelos muito parelhos.
- A economia (prêmios de 15 a 150 mil CR, 561 mil no total, e a reputação) não foi alterada nesta etapa; o custo de preparar o C 43 (Stage 2) continua em ≈ 28.600 CR sobre o preço do carro. Os prêmios do 5.º ao 9.º duelo não foram revistos além da matriz acima.
- Não foi feita uma simulação de campanha completa com compras por estratégia. A extração (somente leitura) de um save real não foi feita: o 335i de referência vem do catálogo.
