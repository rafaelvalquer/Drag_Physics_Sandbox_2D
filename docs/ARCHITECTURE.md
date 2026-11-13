# Arquitetura

## Visão geral

```
Teclado / botões na tela ─► InputManager ─► Mode (Sandbox | Corrida | Dinamômetro)
                                              │
                                              ▼
                                    SimulationRunner (passo fixo 1/120 s)
                                              │  por passo: controle (jogador / IA / RaceController)
                                              ▼
                                    VehicleSimulation × N ──► telemetria (HUD, DevLab, CSV)
                                              │
                                              └─► quadro de áudio (Float64Array, layout AF)
                                                        │  postMessage em lotes
                                                        ▼
                                    VehicleSound ─► AudioWorkletNode (vehicle-audio.worklet)
                                                        │  TelemetryStream → VehicleAcoustics
                                                        ▼
                                    7 canais → mixer → pan/Doppler/distância → master → saída

Phaser (RaceScene) ◄── SceneBridge ◄── Mode.vehicles()/track()/markers()/tree()
```

A física é a **única fonte de verdade**. A cena, o HUD e o áudio apenas leem o estado; nenhum deles escreve na simulação.

## Pastas

| Pasta | Conteúdo |
|---|---|
| `src/core` | contratos (layout do quadro de áudio `AF`, telemetria), matemática, PRNG determinístico, unidades |
| `src/physics/solver` | solver de restrições de velocidade com limites (Gauss–Seidel projetado, port do atg_scs) |
| `src/physics/engine` | motor de valor médio, escoamento compressível, turbo, ignição, controle de marcha lenta, dinamômetro |
| `src/physics/drivetrain` | câmbio sequencial, embreagem automática, sequenciador de trocas |
| `src/physics/vehicle` | modelo longitudinal do veículo, pneu (Magic Formula + temperatura) |
| `src/audio/dsp` | modelo acústico: guias de onda, rede de escapamento, fontes do motor, turbo, pneus, transmissão, vento, filtros, `TelemetryStream` |
| `src/audio/worklets` | processador AudioWorklet (uma voz por veículo, 7 saídas mono) e protocolo de mensagens |
| `src/audio/core` | `AudioEngine` (contexto, master, analisador), `VehicleSound` (nó, mixer, espacialização) |
| `src/game` | `SimulationRunner`, IA, `RaceController` (árvore, feixes, parciais), entrada, cena Phaser e arte procedural |
| `src/modes` | os três modos de jogo (interface `Mode`) |
| `src/app` | `App` (barra superior, troca de modos, portão de áudio, Phaser), configurações, adaptador física → cena |
| `src/ui` | HUD, DevLab, gráficos, editor de carro e pista, configurações, botões na tela |
| `src/data` | esquema zod, carros, motores, pistas, presets de escapamento |
| `src/storage` | IndexedDB (presets, recordes, histórico de corridas, configurações) com migrações e fallback em memória |
| `src/telemetry` | gravador de telemetria (anel com contagem de perdas, exportação CSV) |
| `third_party` | cópias de referência dos arquivos upstream portados (somente leitura, não compilados) |

## Tempo e laço principal

- `RaceScene.update()` mede o **tempo real** entre quadros com `performance.now()`. O `delta` do Phaser é suavizado e quantizado, e usá-lo faria a física derivar do relógio de áudio.
- `SimulationRunner.advance(realDt)` acumula esse tempo e executa passos fixos de 1/120 s. Um quadro com mais de 0,25 s, como uma aba em segundo plano ou um travamento, não é recuperado: o excesso é contado em `stats.droppedRealTimeS`. Esse valor aparece no DevLab e nas notas do CSV.
- Cada passo, na ordem:
  1. os controladores (jogador, IA e `RaceController.beforeStep`) escrevem os comandos;
  2. `VehicleSimulation.step(h)` integra;
  3. os ganchos `afterStep` registram a telemetria e os eventos de corrida.

  Os feixes de largada e chegada são interpolados dentro do passo, então RT, parciais e ET têm resolução muito melhor que 8,3 ms.
- **Independência da taxa de quadros:** o resultado não depende dela. Um teste de integração roda a mesma corrida a 30, 60 e 144 fps e obtém ETs idênticos.

## Áudio

- Cada passo de física gera um quadro de controle (`AF`) com rpm, ângulo do virabrequim, carga, pressões, eventos de ignição, corte de faísca, turbo, patinagem, marcha e outros dados. Os quadros vão ao worklet em lotes de até 64 por mensagem.
- No worklet, o `TelemetryStream` mantém um buffer de jitter (50 ms). A taxa de reprodução é ajustada em no máximo ±2 % para acompanhar a deriva entre o laço de renderização e o relógio de áudio, e os parâmetros são interpolados por amostra.
- **Perda de telemetria:** quando os quadros param, o som desaparece suavemente; quando voltam, o fluxo ressincroniza sob o fade. Quadros com valores não finitos são rejeitados.
- **Sete canais por voz** (admissão, bloco, escape, turbo, pneus, transmissão, ambiente):
  - `GainNode`s formam o mixer;
  - o pan, o atraso de propagação (Doppler) e a atenuação por distância são calculados em relação a um ouvinte que acompanha o jogador, 7 m ao lado da pista.
- Todo estado DSP é alocado na construção da voz; `process()` não aloca. Os filtros descartam valores denormais.

## Cena (Phaser 4)

- **`SceneBridge`:** a cena só conversa com a física por essa interface, implementada pelo `App`, que delega ao modo ativo.
- **Câmera:** tem três modos e respeita os limites da pista e o zoom do usuário.
- **Carros:** são SVG procedurais gerados a partir das dimensões reais (entre-eixos, raio do pneu, balanços). Por isso, um carro editado sempre corresponde à sua geometria física.
- **Efeitos visuais** (fumaça, marcas de pneu, pulsos de escape, vibração em marcha lenta, poeira): derivam do estado físico, mas são apenas visuais. Ver [LIMITATIONS.md](LIMITATIONS.md).

## Validação e persistência

- **Validação:** toda configuração de carro ou pista passa pelo esquema zod (`src/data/schema.ts`). As mensagens estão em português (`z.locales.ptBR()` mais mensagens próprias) e o editor associa cada erro ao rótulo do campo.
- **IndexedDB `drag-physics-sandbox-2d`, versão 2:**

  | Store | Chave | Conteúdo |
  |---|---|---|
  | `presets` | `id` | presets de carro |
  | `records` | `carro\|distância\|pista` | melhor ET por combinação |
  | `runs` | auto-incremento, índice por data | histórico de corridas |
  | `settings` | — | configurações |

  A migração v1→v2 converte valores legados.
- **Sem IndexedDB** (modo privado, por exemplo): usa-se um armazenamento em memória e o usuário é avisado.
