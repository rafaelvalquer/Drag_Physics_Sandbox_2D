# Integração open source

O projeto porta código de três repositórios MIT do C++ e do JavaScript para TypeScript. Nenhum deles é uma dependência de pacote: o código foi lido, traduzido, adaptado ao modelo de passo fixo de 120 Hz e corrigido onde necessário.

- **Cópias de referência:** os arquivos upstream usados estão em [`third_party/`](../third_party), exatamente como no commit indicado, com a licença original. Eles não são compilados nem incluídos no build.
- **Rastreabilidade:** todo trecho portado tem um bloco `ORIGIN` (de onde veio, com o aviso MIT) e um bloco `CHANGES` (o que mudou e por quê) no próprio arquivo de destino.

## Repositórios e commits

| Projeto | Repositório | Commit | Data | Licença |
|---|---|---|---|---|
| engine-sim | [ange-yaghi/engine-sim](https://github.com/ange-yaghi/engine-sim) | `85f7c3b959a908ed5232ede4f1a4ac7eafe6b630` | 2023-01-22 | MIT, © 2022 AngeTheGreat (Ange Yaghi) |
| simple-2d-constraint-solver (`atg_scs`, submódulo do engine-sim) | [ange-yaghi/simple-2d-constraint-solver](https://github.com/ange-yaghi/simple-2d-constraint-solver) | `e009f4ff1c9c4c5874e865e893cdb62e208fb2b3` | 2022-09-07 | MIT, © 2022 Ange Yaghi |
| engine-sound-generator | [Antonio-R1/engine-sound-generator](https://github.com/Antonio-R1/engine-sound-generator) | `c76c5adb9e63f5a54fb0def3b97e8e0ac1a7dea1` | 2022-11-07 | MIT, © 2021-2022 Antonio-R1 |

Os textos de licença estão em [`LICENSES/`](../LICENSES) e são resumidos em [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).

## engine-sim → física

O engine-sim é um simulador C++ de alta frequência (10 kHz ou mais) com corpos rígidos 2-D e dinâmica de gases por cilindro. Ele não roda no navegador nem a 120 Hz, então foi portado **por componente**, preservando a física de cada um.

| Upstream | Destino | O que foi aproveitado | Alterações |
|---|---|---|---|
| `gas_system.cpp/.h`: `flowRate`, `chokedFlowLimit`, `chokedFlowRate` | `src/physics/engine/GasFlow.ts` | escoamento compressível por orifício, subsônico e estrangulado | vazão mássica (kg/s) com a constante específica do ar, em vez de vazão molar; `k_flow` passa a ser área efetiva (C_d·A) |
| `intake.cpp`: `flowAttenuation` | `GasFlow.ts` | atenuação da borboleta cos(posição·π/2) | — |
| `ignition_module.cpp/.h` | `src/physics/engine/IgnitionModule.ts` | tabela de ângulos de ignição em 720°, detecção de eventos cruzados e limitador por tempo com histerese | **correção:** no wrap de 4π, o original desloca todos os ângulos e perde velas entre o ângulo anterior e 4π. É inofensivo a 10 kHz, mas não a 120 Hz; aqui só são deslocadas as velas antes do ângulo anterior. Rotação positiva = para frente. Contagem de eventos por passo, já que vários cilindros podem disparar em 8,3 ms. Corte de faísca parcial para as trocas. |
| `engine.cpp`: `placeRod`, `calculateDisplacement` | `src/physics/engine/EngineGeometry.ts` | cinemática biela-manivela e cilindrada | forma fechada s(α) = r·cos α + √(l² − r²·sin² α), em vez da integração numérica de 1000 amostras, que o próprio original aponta como substituível |
| `direct_throttle_linkage.cpp` | `src/physics/engine/EngineModel.ts` | lei pedal → borboleta, posição = s^γ | γ configurável por motor |
| `starter_motor.cpp`, `dynamometer.cpp` | `EngineModel.ts`, `EngineDyno.ts` | motor de partida e dinamômetro como restrições de velocidade limitadas; o dinamômetro **mede** o torque que precisa absorver | linhas do solver 1-D próprio |
| `vehicle_drag_constraint.cpp` | `src/physics/vehicle/VehicleSimulation.ts`, `src/core/units.ts` | resistência ao rolamento como limite de atrito que só desacelera até o repouso; densidade do ar ρ = p·M/(R·T) | o arrasto aerodinâmico passou a ser explícito, porque o vento pode empurrar nos dois sentidos; a densidade foi generalizada para pressão e temperatura da pista |
| `transmission.cpp` + `clutch_constraint` | `VehicleSimulation.ts` | embreagem como restrição ω_e − G·ω_w = 0 com \|λ\| ≤ T_max·acoplamento | o acoplamento vem do controlador automático (`AutomaticClutchController`) |
| `piston_engine_simulator.cpp` | `EngineModel.ts` | 8 subpassos de fluido por passo (`setFluidSimulationSteps(8)`) | aplicado ao coletor de valor médio |
| `engine.h` / `crankshaft.cpp` | `src/core/math.ts`, `src/core/contracts.ts` | `positiveMod` e ângulo de ciclo 0..4π (`getCycleAngle`) | — |

**Consultados sem porte direto:** `governor.cpp`, `leveling_filter.cpp`, `derivative_filter.cpp` e `vehicle.cpp` estão em `third_party/` porque foram lidos para entender o comportamento do original. O controle de marcha lenta (`IdleAirController.ts`), por exemplo, é código novo: PI com alocação de polos e dashpot, não o governor do engine-sim.

### Por que não portar o simulador de cilindros completo

A simulação por cilindro do engine-sim exige passos de 10 kHz ou mais para ser estável. Um passo de física de 120 Hz, exigido pela especificação, com dois carros, IA e cena, não comporta isso. Por isso:

- a física usa um **modelo de valor médio**, que reproduz o torque configurado com erro de 0,02 % a 0,05 % no dinamômetro;
- a parte por cilindro (ângulo do virabrequim, ordem de ignição, blowdown) é feita no **áudio**, a 44,1 ou 48 kHz, onde há resolução temporal para ela.

## simple-2d-constraint-solver (`atg_scs`) → solver

| Upstream | Destino | O que foi aproveitado | Alterações |
|---|---|---|---|
| `gauss_seidel_sle_solver.cpp`: `solveWithLimits` | `src/physics/solver/ConstraintSolver.ts` | Gauss–Seidel projetado para J·W·Jᵀ·λ = rhs com cada λ limitado a [lo, hi] | resolve em nível de velocidade dentro de um passo de Euler semi-implícito, em vez de em nível de aceleração com termos de Baumgarte |
| `constraint.cpp`, `clutch_constraint.cpp`, `rotation_friction_constraint.cpp` | `ConstraintSolver.ts` (`ConstraintRow`), `EngineModel.ts`, `VehicleSimulation.ts` | a forma "linha jacobiana + bias + limites de torque" | graus de liberdade escalares (ω do motor, ω da linha, v) em vez de corpos 2-D; **CFM** adicionado para representar força complacente linearizada (pneu) |

## engine-sound-generator → áudio

O engine-sound-generator é um AudioWorklet em JavaScript (com uma versão C++/WASM) que gera som de motor com guias de onda. Ele foi integrado a uma aplicação **Three.js**. Aqui a dependência do Three.js foi eliminada: um adaptador próprio para Web Audio e Phaser (`VehicleSound` + `vehicle-audio.worklet.ts`) mantém o núcleo DSP portado.

| Upstream | Destino | O que foi aproveitado | Alterações |
|---|---|---|---|
| `waveguide.js`, `sound_generator_wasm/waveguide.cpp/.h`: `DelayLine`, `Waveguide` | `src/audio/dsp/Waveguide.ts` | guia de onda bidirecional (duas linhas de atraso) com reflexão parcial nas pontas | comprimento em **metros**, atraso = L/c(T)·fs com a taxa **real** do AudioContext (o original usava contagens inteiras para 44,1 kHz); atraso fracionário que acompanha a temperatura do gás; leitura e escrita separadas para redes; perdas de parede e termoviscosas; memória alocada uma única vez |
| `engine_sound_generator_worklet.js`: `Cylinder`, `Engine` | `src/audio/dsp/EngineAcoustics.ts` | uma fonte por cilindro defasada pela ordem de ignição; guias de admissão e escape por cilindro; reflexão dependente da válvula; três saídas (admissão, bloco, escape) | o pulso analítico fixo com jitter aleatório foi substituído por blowdown de dinâmica de gases a partir de carga, compressão e comando de válvulas; ordem de ignição de 720° configurável; admissão com runner e Helmholtz; bloco com forças de inércia, Wiebe e ressonâncias; variação ciclo a ciclo com semente |
| `Muffler` e `Cylinder.updateWaveguidesReflectionValues` | `src/audio/dsp/ExhaustNetwork.ts` | cadeia cilindro → coletor → tubo → abafador (elementos em paralelo, absorção `action`) → saída; fatores de reflexão por abertura de válvula | geometria em metros e milímetros a partir do carro; junções de espalhamento N-portas ponderadas por área; Y ou dupla; ressonador de quarto de onda; ponteira aberta com reflexão invertida e radiação; velocidade do som pela EGT |
| `LowpassFilter` | `src/audio/dsp/Filters.ts` (`OnePole`) | passa-baixas de um polo | **correção:** o original fixava fs = 44 100 Hz; aqui fs é argumento e o polo é exato, e^(−2π·f/fs); valores denormais são descartados |
| `sound_generator_worklet.js`: `SoundGenerator` (caminho Doppler) | `src/audio/core/VehicleSound.ts` | atraso de propagação distância/c num `DelayNode` com rampas lineares | sem Three.js (`PositionalAudio`/`AudioListener`); pan de potência constante e atenuação por distância próprios; mixer de 7 canais |

### Requisitos da especificação para o áudio

| Requisito | Onde está atendido |
|---|---|
| taxa real do AudioContext | todo o DSP recebe `sampleRate`; teste de mesmo tom e equilíbrio a 44,1 e 48 kHz |
| metros → atraso | `pipeDelaySamples` em `Waveguide.ts` |
| fases de ignição de 720°, ordens e virabrequins diferentes | `firingAnglesDeg` por motor (cross-plane, flat-plane, I4, I6, V6, V12); teste de que trocar a ordem muda o som |
| carga e borboleta, além de rpm | quadro `AF` com carga, pressão no coletor, boost, borboleta e corte de faísca |
| sem descontinuidades | `TelemetryStream` com jitter buffer, PLL de fase e fades; teste de varredura sem cliques |
| dois motores simultâneos | uma voz independente por veículo; teste bit a bit de duas vozes juntas = cada uma sozinha |

### WebAssembly

O original tem uma versão C++/WASM do gerador. Ela **não** foi usada: o custo medido em TypeScript é de 5,6 % a 11 % de um núcleo por voz (`npm run bench`), suficiente para duas vozes. Assim o projeto evita uma toolchain Emscripten no build. A pasta `src/audio/wasm` prevista na especificação não foi criada. Ver [LIMITATIONS.md](LIMITATIONS.md).

## Dependências de execução

| Pacote | Versão | Licença | Observação |
|---|---|---|---|
| phaser | 4.2.1 | MIT | motor de renderização da cena |
| eventemitter3 | 5.0.4 | MIT | dependência transitiva do Phaser, incluída no bundle |
| zod | 4.6.7 | MIT | validação de configurações |

Essas são as únicas dependências que vão para o build de produção (`npm ls --omit=dev --all`).

As ferramentas de desenvolvimento não são distribuídas e usam licenças MIT, Apache-2.0, ISC, BSD-3-Clause ou MPL-2.0 (lightningcss, via Vite). São elas: Vite 8, Vitest, TypeScript, tsx, Playwright e fake-indexeddb.

## Recursos

Nenhuma gravação, música, logotipo ou modelo de carro real foi usado. Os carros, as pistas e os sprites são originais e gerados por código (`src/game/scenes/trackArt.ts`, `scripts/assets/export-sprites.ts`). Todo o som é sintetizado.
