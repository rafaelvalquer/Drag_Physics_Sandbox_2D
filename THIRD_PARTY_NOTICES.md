# Avisos de terceiros

Este projeto inclui código adaptado de projetos de terceiros e usa bibliotecas distribuídas no build. Todos estão sob a licença MIT. Os textos completos estão em [`LICENSES/`](LICENSES). Como cada trecho foi portado está em [docs/OPEN_SOURCE_INTEGRATION.md](docs/OPEN_SOURCE_INTEGRATION.md).

## Código adaptado (portado para TypeScript)

### engine-sim

- Repositório: https://github.com/ange-yaghi/engine-sim
- Commit: `85f7c3b959a908ed5232ede4f1a4ac7eafe6b630`
- Copyright 2022 AngeTheGreat (Ange Yaghi)
- Licença: MIT, em [`LICENSES/engine-sim.MIT.txt`](LICENSES/engine-sim.MIT.txt)
- Usado em: `src/physics/engine/GasFlow.ts`, `IgnitionModule.ts`, `EngineGeometry.ts`, `EngineModel.ts`, `EngineDyno.ts`, `src/physics/vehicle/VehicleSimulation.ts`, `src/core/units.ts`, `src/core/math.ts`

### simple-2d-constraint-solver (atg_scs)

- Repositório: https://github.com/ange-yaghi/simple-2d-constraint-solver
- Commit: `e009f4ff1c9c4c5874e865e893cdb62e208fb2b3`
- Copyright (c) 2022 Ange Yaghi
- Licença: MIT, em [`LICENSES/simple-2d-constraint-solver.MIT.txt`](LICENSES/simple-2d-constraint-solver.MIT.txt)
- Usado em: `src/physics/solver/ConstraintSolver.ts`

### engine-sound-generator

- Repositório: https://github.com/Antonio-R1/engine-sound-generator
- Commit: `c76c5adb9e63f5a54fb0def3b97e8e0ac1a7dea1`
- Copyright (c) 2021-2022 Antonio-R1
- Licença: MIT, em [`LICENSES/engine-sound-generator.MIT.txt`](LICENSES/engine-sound-generator.MIT.txt)
- Usado em: `src/audio/dsp/Waveguide.ts`, `ExhaustNetwork.ts`, `EngineAcoustics.ts`, `Filters.ts`, `src/audio/core/VehicleSound.ts`

Cópias de referência dos arquivos originais usados, com as licenças originais, estão em [`third_party/`](third_party). Elas não fazem parte do build.

## Bibliotecas incluídas no build

| Pacote | Versão | Copyright | Licença |
|---|---|---|---|
| [Phaser](https://github.com/phaserjs/phaser) | 4.2.1 | (c) 2026 Richard Davey, Phaser Studio Inc. | MIT, em [`LICENSES/phaser.MIT.txt`](LICENSES/phaser.MIT.txt) |
| [eventemitter3](https://github.com/primus/eventemitter3) (dependência do Phaser) | 5.0.4 | (c) 2014 Arnout Kazemier | MIT, em [`LICENSES/eventemitter3.MIT.txt`](LICENSES/eventemitter3.MIT.txt) |
| [Zod](https://github.com/colinhacks/zod) | 4.6.7 | (c) 2025 Colin McDonnell | MIT, em [`LICENSES/zod.MIT.txt`](LICENSES/zod.MIT.txt) |

## Ferramentas de desenvolvimento (não distribuídas)

Vite, Vitest, TypeScript, tsx, Playwright e fake-indexeddb são usados apenas para desenvolver e testar e não entram no build. Suas licenças (MIT, Apache-2.0, ISC, BSD-3-Clause, MPL-2.0) estão nos respectivos pacotes em `node_modules`.

## Recursos

Não há gravações, músicas, fontes, logotipos ou modelos de carros reais. Gráficos e sons são gerados por código deste projeto.
