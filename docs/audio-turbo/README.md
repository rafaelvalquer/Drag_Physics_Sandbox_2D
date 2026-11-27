# Turbo Acoustics 2.0

Os WAVs A/B/C/D, os espectrogramas e a matriz de homologação mais recentes estão na
[documentação da revisão 2.1](v21/README.md). As medições abaixo registram a revisão 2.0.

Reconstrução procedural do som de turbo para todos os turbos do jogo: kits clássicos da oficina, turbos
de fábrica (capítulos 2 e 3), conversões turbo, twin-scroll e biturbo paralelo. Nenhuma gravação é usada.
Tudo é sintetizado a partir do estado da física (rotação do eixo, boost, vazão da válvula, borboleta,
carga), que **não foi alterado**: física, boost, rotação do rotor, potência e economia são idênticos aos de
`main` (ver [Regressão](#regressão)).

> **Status:** as métricas objetivas estão documentadas aqui, mas a fidelidade acústica **não está
> comprovada**. A aprovação final é do responsável pelo jogo, após a escuta descrita em
> [listening-validation.md](listening-validation.md). Até lá, a comparação A/B no Sandbox continua
> disponível.

## Arquitetura

O turbo continua no canal `CH.turbo` (os 7 canais e o mixer não mudaram). `AuxAcoustics` delega a um
dos dois modelos:

| Modelo | Classe | Uso |
|---|---|---|
| `v2` (padrão) | `src/audio/dsp/turbo/TurboAcoustics.ts` | Turbo Acoustics 2.0 |
| `legacy` | `src/audio/dsp/turbo/LegacyTurboAcoustics.ts` | cópia do modelo anterior, mantida só para o A/B |

Camadas do 2.0 (cada uma com seu próprio PRNG, separado do da transmissão):

| Camada | Arquivo | Entrada física | Resumo |
|---|---|---|---|
| Rotor | `TurboRotorWhine.ts` | `turboShaftRpm`, `turboShaftRpm2` | ordens 1X, 2X, 3X e BPF (pás × rotação) com fase contínua e fade anti-aliasing por parcial (min(15 kHz, 0,7·Nyquist) → min(18,5 kHz, 0,86·Nyquist)); 2º rotor independente no biturbo paralelo |
| Fluxo (whoosh) | `CompressorWhoosh.ts` | rotação, boost, vazão estimada | corpo, turbulência, brilho e banda de instabilidade; centros móveis; nível segue a vazão, não só o boost |
| Blow-off | `BlowOffAcoustics.ts` | `bovFlow` | atmosférica (jato + corpo + ressonância da válvula), recirculada (passa-baixa, mais contida) ou ausente (silêncio) |
| Flutter | `CompressorFlutter.ts` | borboleta, boost, rotação, válvula | máquina de estados INACTIVE → ARMED → PRESSURE_RELEASE → OSCILLATING → DECAYING; série limitada (máx. 14 pulsos), amortecida, taxa segue o rotor desacelerando |
| Wastegate | `WastegateAcoustics.ts` | limite de eixo da física (√(1/1,3)), boost, carga | interna (discreta), externa recirculada, externa aberta (descarga) |
| Ressonâncias | `TurboDuctResonance.ts` | perfil | até 3 ressonâncias de duto + atenuação da admissão (caixa de ar ↔ filtro aberto) |
| Mixer | `TurboAcousticMixer.ts` | — | soma, normalização do biturbo (1/√2 por rotor) e ganho de saída `TURBO_V2_OUTPUT` |

O controle roda em blocos de 32 amostras com interpolação por amostra; derivadas são filtradas; o ruído
é escalado por √(fs/48 kHz), então 44,1 e 48 kHz têm o mesmo nível.

### Perfis por dados

`TurboAcousticProfiles.ts` define 13 perfis base:

`classic-small-turbo`, `classic-medium-turbo`, `classic-large-turbo`, `modern-small-oem`,
`modern-medium-oem`, `modern-performance-oem`, `modern-twin-scroll`, `modern-hybrid-turbo`,
`modern-big-turbo`, `modern-na-conversion`, `v6-single-conversion`, `v6-parallel-twin-oem`,
`v6-parallel-twin-upgraded`.

`TurboProfileResolver.ts` escolhe a base e aplica, nesta ordem:

1. dica explícita de perfil (se válida);
2. conversão turbo → base de conversão da família;
3. turbo de fábrica (estágio 2+ → perfil *upgraded* da família);
4. kit clássico (básico/rua → small, médio → medium, forte → large; família clássica sem dica → small);
5. classe pela rotação máxima do rotor.

Depois aplica o *patch* da família do motor (`FAMILY_ACOUSTICS`: EA113, EA888, N20, N55, VQ, VR38…), o
estágio, a turbina escolhida, a exposição da admissão, o volume extra de intercooler (desloca as
ressonâncias de Helmholtz) e os tipos de válvula e wastegate. O mesmo hardware gera o mesmo perfil:
Golf GTI e A3 (EA113) soam iguais, sem distinção por marca. N20 e N55 compartilham a classe do compressor
(twin-scroll), mas não a assinatura final.

As dicas vêm das peças instaladas (`src/game/career/tuning/turboAcousticHints.ts`) e são gravadas em
`car.acoustic.turbo` pelo `BuildResolver`, então oficina, Sandbox, campanha, dinamômetro e multiplayer (que
transmite o `CarConfig` completo) usam o mesmo perfil. Carros de catálogo sem peças não ganham dicas e
continuam byte a byte idênticos.

A matriz completa por veículo está em [coverage-matrix.md](coverage-matrix.md), incluindo os protótipos
Vetra RS e Orion XR (turbo de laboratório, perfis `vetra-i4` e `orion-i6`).

### Twin-scroll ≠ biturbo

Twin-scroll (N20, N55) é **um** rotor com carcaça dividida: mais pulsação de escape no rotor, um único
conjunto de ordens. Biturbo paralelo (C43, Stinger, Ghibli, Giulia QV, GT-R) são **dois** rotores com
fase própria; as velocidades vêm de `turboShaftRpm` e `turboShaftRpm2` (diferença de 1,5% na física), o
que gera duas linhas de BPF separadas. Uma conversão em V6 usa um rotor só.

## Integração por modo

| Modo | Como recebe o turbo |
|---|---|
| Sandbox | `carToAcousticConfig` do carro/preset; painel **Turbo: comparação A/B (dev)** com seletor legado/2.0 e isolamento de camadas |
| Oficina / campanha | `resolveBuild` grava as dicas; corrida usa `carToAcousticConfig(v.sim.car)` |
| Dinamômetro | `DynoMode` usa `carToAcousticConfig`; telemetria do turbo vem do quadro de áudio da simulação |
| Multiplayer | `CarConfig` completo + snapshots a 20 Hz interpolados pelo `TelemetryStream`; `bovFlow` interpolado continua disparando a válvula; adversário em qualidade baixa usa o caminho `low` (sem 3X, sem wastegate interna, 1 ressonância) |

## Ferramentas

```powershell
npx tsx scripts/audio-turbo-lab.ts --car=vw-gol-gts-1988 --scenario=tip-out --model=both
```

```powershell
npx tsx scripts/audio-turbo-lab.ts --all --scenario=steady,spool-sweep --rate=44100 --quality=low
```

```powershell
node --import tsx scripts/audio-turbo-report.ts --write-levels
```

- `audio-turbo-lab.ts`: cenários sintéticos (`steady`, `spool-sweep`, `tip-out`, `gear-shift`, `twin`,
  `stress`, `idle`, `engine-off`) e `physics` (condução real); `--wav=<dir> --layers` exporta cada camada
  isolada; `--bov=none|atmosphere|recirculating` e `--wastegate=…` trocam o hardware só no laboratório.
- `audio-turbo-report.ts` na revisão 2.0 (`81ac068`): WAVs antes/depois com o mesmo ganho por build, espectrogramas, relatório
  espectral, matriz de calibração (nível A e custo) e matriz de cobertura.
- `audio-turbo-baseline.ts` e `audio-turbo-channel-hash.ts`: capturam a linha de base em `main`
  (`before/physics-fingerprint.json`, `before/channel-hash.json`, `before/legacy-turbo-level.json`).

## Arquivos

| Caminho | Conteúdo |
|---|---|
| `before/*-turbo.wav` | canal turbo isolado, modelo legado, condução física (32 kHz) |
| `after/*-turbo.wav` | mesmo trecho e mesmo ganho, Turbo Acoustics 2.0 |
| `before|after/*-vehicle.wav` | veículo completo (mix padrão), Gol e GT-R |
| `spectrograms/` | espectrogramas antes/depois |
| [spectral-report.md](spectral-report.md) | centroide, energia > 8 kHz, tonal/ruído, eventos de válvula e flutter |
| [calibration-matrix.md](calibration-matrix.md) | nível A antes/depois e custo de CPU |
| [coverage-matrix.md](coverage-matrix.md) | perfil resolvido por veículo |
| [listening-validation.md](listening-validation.md) | protocolo e ficha de escuta (pendente) |

## Regressão

`tests/unit/audio/turbo-acoustics-regression.test.ts` compara com a linha de base capturada em `main`:

- **Física:** hash de todos os quadros de áudio/telemetria de uma condução fixa e hash do `CarConfig`
  (sem o bloco acústico) idênticos para builds clássicos, de fábrica, conversões e biturbo.
- **Canais:** carros aspirados com os 7 canais idênticos bit a bit; nos turbo, admissão, bloco, escape,
  pneus e ambiente idênticos bit a bit, nos dois modelos.
- **Transmissão:** nos carros turbo o ruído da transmissão compartilhava o PRNG com o turbo antigo. Agora
  cada fonte tem seu fluxo, então o canal de transmissão desses carros mudou uma única vez e passou a
  ser independente do modelo de turbo (legado e 2.0 geram exatamente o mesmo canal).
- **Legado:** pelo mesmo motivo, o ruído do modelo legado não é mais a mesma sequência de `main`; o teste
  confere nível (± 0,5 dB) e centroide (± 5%).

## Decisões e limitações

- O flutter não é forçado: nasce da energia (boost^1,2 × rotação × (1 − alívio da válvula)). Sem válvula,
  ele é forte e longo. Válvulas de fábrica (recirculadas, 0,08–0,10 s) absorvem o refluxo e nenhum carro
  de fábrica gera flutter na condução de referência. Com a válvula atmosférica mais lenta dos kits
  (0,14 s) sobra um flutter curto e ≥ 10 dB mais fraco que sem válvula.
- A wastegate é estimada pelo limite de eixo da física (a física não exporta a abertura).
- A exposição da admissão e o volume do intercooler mudam o timbre, nunca o boost.
- O ganho global foi alinhado ao legado pelo nível A em carga plena nos kits e conversões (± 1 dB), para o
  A/B não favorecer o mais alto. Turbos de fábrica ficam 4–7 dB abaixo de propósito (caixa de ar, válvula
  recirculada); o legado soava igual em todos.
- Custo: voz completa +14% de CPU em média (meta < 15%), ver [calibration-matrix.md](calibration-matrix.md).
  Rotor sem trigonometria quando silencioso, BPF por potência complexa do fasor 1X, duto ocioso no silêncio.
- Não há medição de referência: os perfis seguem coerência física e as métricas acima. Fidelidade só
  depois da validação auditiva.
