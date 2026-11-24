# Nitro (N₂O)

Sistema de óxido nitroso da carreira, do Sandbox e dos Eventos Livres. Tudo vem da física: o kit injeta uma
vazão de massa, a vazão vira potência, a potência vira torque no virabrequim e esse torque passa pelo motor,
pela embreagem/câmbio e pelos pneus como qualquer outro. Não há multiplicador fixo de aceleração ou velocidade.

## Regras de jogo

- **Sem botão de armar.** Um toque em **Shift esquerdo** (remapeável em Ajustes) inicia o próximo estágio na hora.
  Repetição automática da tecla é ignorada; soltar não interrompe; não há cancelamento. A descarga corre até acabar a reserva do estágio.
- **Dois estágios dividem UM cilindro.** Estágio 1 recebe 20–80 % (passo de 5 %), o 2 recebe o resto. Cada estágio tem vazão
  e rampa (0–3 s) próprias. O 2º estágio exige um segundo toque; um toque feito durante o estágio 1 é recusado, nunca enfileirado.
- **Cilindro cheio em toda tentativa nova** (reiniciar, nova corrida, novo teste no Dyno). Pausa, câmera e HUD não reabastecem nem gastam.
  Não existe recarga, compra ou custo por uso. Só o id do kit e o ajuste ficam salvos.
- **Um kit por carro**; instalar outro o substitui. A massa do kit é sempre carregada, mesmo sem usar.
- **Pedido recusado não gasta nada**: motor desligado/quebrado, sem combustível ou abaixo da rotação mínima do kit.
  O limitador de giro e o corte de ignição da troca **não** interrompem a descarga: ela segue gastando o cilindro, e o torque extra só soma nos passos em que o motor queima.

## Kits (categoria “Nitro / N₂O”)

| Kit | Preço | Liberação | Pot. ref. | Cilindro | Massa |
|---|---|---|---|---|---|
| Street Shot | 2.500 CR | Cap. 1, 5ª corrida | 45 cv | 20 g | 6 kg |
| Wet Performance | 7.500 CR | Cap. 2, evento 4 | 90 cv | 40 g | 9 kg |
| Progressive Race | 15.000 CR | Cap. 2, evento 8 | 160 cv | 75 g | 12 kg |
| Direct Port Competition | 32.000 CR | Cap. 3, evento 5 | 250 cv | 115 g | 16 kg |

A potência de referência é a vazão máxima do kit: `P = vazão · 12,3 MJ/kg · fator de combustível`. O fator de combustível é
`min(1, alimentação/necessidade)^1,5`: bomba fraca entrega menos que o anunciado. Torque extra `T = P/ω`.
O torque total sofre o limite dos internos (ver `EngineOverrevFailure.updateTorque`): passar do limite de torque do motor por
alguns segundos o quebra, como no turbo.

## Onde está no código

- `src/game/career/tuning/nitrousParts.ts`: catálogo e constantes. `nitrousOverlay.ts`: ajuste, limites, validação e sobreposição no carro.
- `src/physics/engine/NitrousController.ts`: máquina de estados (UNAVAILABLE, READY, STAGE_1_ACTIVE, STAGE_2_READY, STAGE_2_ACTIVE, DEPLETED, DISABLED).
  Só avança por passo de física, determinístico.
- `EngineModel.nitrousTorqueNm`: somado ao torque de combustão só enquanto queima. `VehicleSimulation.requestNitrous()`.
- Resolvedor: o kit **não** é peça de nenhum dos dois resolvedores; `resolveBuild` o separa, resolve o resto como sempre e aplica
  `applyNitrousOverlay` (massa + `car.nitrous`). Builds sem kit resolvem exatamente como antes (v1 intocado).
- Regulagem: aba **Nitro** do Dyno Lab (`src/ui/career/nitrousPanel.ts`, `buildNitrousTab`; a Oficina só instala o kit e aponta para o Dyno) (modo único/duplo, divisão, vazão e rampa por estágio, prévia ao vivo de potência, torque,
  duração, risco e tração). HUD: `RacingHUD` (reserva, modo, estágio, estado em texto). Entrada: `InputManager` (ação `nitrous`).
- Áudio: `src/audio/core/NitrousLayer.ts` (chiado proporcional à vazão e cliques da solenoide), acionado por transição de estado em
  `SimulationRunner`. Partículas: sopros no escape proporcionais à vazão (`VehicleVisualController`), reaproveitando o pool existente.
- Dyno Lab: `measureLab(..., { nitrous: 'off' | 'stage1' | 'all' })`. Curvas por estágio **medidas na bancada** (`EngineDyno.nitrous`),
  consumo e tempo de injeção da corrida de teste. Padrão `off`: os números antigos do Dyno não mudam.
- IA/Eventos Livres: `DragAI` usa o nitro pelas mesmas regras (marcha ≥ 2 e tração ok para o estágio 1, marcha ≥ 3 para o 2;
  nunca recarrega). Rivais livres só levam kit por faixa (nada em iniciante, só o Street Shot em rua, o Direct só em competição) e raramente (18 %).
- Telemetria: canais `nitroStage`, `nitroFlow`, `nitroTq`, `nitroLeft`.

## Balanceamento

`npx tsx scripts/nitrous-balance.ts [id-do-carro]` mede cada kit em cada carro de referência a 201 / 402 / 1000 m, sem e com nitro,
com a IA do jogo. Resultado em `docs/NITROUS_BALANCE.md`.

Pontos que o resultado confirma (e são intencionais): kit grande demais num carro fraco rende **menos** que o kit médio
(patinação e limitador); o ganho cai conforme o carro base é mais forte (o nitro soma potência absoluta); em 1ª marcha o torque extra
vira patinação, por isso a IA só injeta a partir da 2ª.
