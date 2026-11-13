# Testes

Os testes usam o código real: a mesma física, o mesmo modelo acústico e a mesma aplicação no navegador. A única substituição é o IndexedDB nos testes unitários, feito com `fake-indexeddb`.

## Unitários e de integração (Vitest)

```bash
npm test
```

| Arquivo | O que verifica |
|---|---|
| `tests/unit/core.test.ts` | cv = W/735,49875; rpm ↔ rad/s; densidade do ar e velocidade do som pela lei dos gases; distâncias oficiais; filtro de primeira ordem exato; interpolação cúbica monotônica sem overshoot; PRNG determinístico |
| `tests/unit/data.test.ts` | os seis carros e as quatro pistas do plano; tabelas de ignição cobrindo 720° com cada cilindro uma vez; mensagens de validação legíveis; cópia profunda independente |
| `tests/unit/input.test.ts` | exatamente três ações de condução (sem embreagem, sem freio); troca dispara uma vez por toque, sem repetição; pedal progressivo (≈ 0,09 s para subir, ≈ 0,07 s para descer); perda de foco solta o acelerador; remapeamento com conflitos e teclas reservadas |
| `tests/unit/storage.test.ts` | criação e leitura do IndexedDB; migração v1 → v2 sem perda; fallback em memória; configurações validadas campo a campo; atalhos com conflito rejeitados |
| `tests/unit/race.test.ts` | IA estagia sozinha e termina; árvore pro (0,4 s) e sportsman (0,5 s por âmbar); RT = saída do feixe − verde, parciais interpoladas e coerentes; queima de largada perde; DNF por tempo; frenagem automática depois da chegada |
| `tests/unit/physics/solver.test.ts` | travamento com conservação do momento; capacidade limitada durante a patinagem; atrito nunca adiciona energia; parada exata sem inversão; CFM equivale a amortecedor 1/cfm |
| `tests/unit/physics/engine.test.ts` | geometria e cilindrada; limitador com histerese (port do engine-sim); partida, marcha lenta e morte do motor sob carga; carga parcial < plena carga; freio-motor; limitador em plena carga; enchimento do turbo e BOV; entradas aleatórias; convergência com o passo; quadro de telemetria coerente |
| `tests/unit/physics/vehicle.test.ts` | Magic Formula (crescimento, pico μ·N, queda, simetria); pico de κ entre 8 e 20 %; linearização dissipativa; desaceleração livre = arrasto + rolamento; **balanço de energia** (resíduo 0,23 %, limite 2 %); transferência de carga; patinagem e aquecimento do pneu em baixa aderência |
| `tests/unit/physics/semiauto.test.ts` | os **dez testes** da alteração do plano (ver abaixo) e a frenagem automática depois da chegada |
| `tests/unit/audio/acoustics.test.ts` | tom e periodicidade por arquitetura a 44,1 e 48 kHz; independência da taxa de amostragem; caráter cross-plane × flat-plane; ordem de ignição; corte de faísca total e parcial; carga; presets de escapamento; robustez (não finitos, telemetria aleatória, cliques, perda e reset); determinismo; qualidade baixa; integração com a física. Detalhes em [ACOUSTIC_MODEL.md](ACOUSTIC_MODEL.md) |
| `tests/integration/runner.test.ts` | resultado independente da taxa de quadros (30/60/144 fps); quadro longo limitado e tempo perdido informado; uma amostra de telemetria por passo, com perdas declaradas no CSV |

### Os dez testes do câmbio semiautomático

1. Larga sem nenhum comando de embreagem, porque não existe controle de embreagem.
2. O acoplamento é progressivo e a patinagem fecha suavemente.
3. A subida corta o torque e passa por todas as fases.
4. A rotação cai para a nova marcha por inércia, nunca atribuída.
5. A redução dá o blip e iguala a rotação antes de reacoplar.
6. A redução que estouraria o giro é recusada.
7. O motor continua ligado quando o carro para engatado.
8. A troca muda os sinais que alimentam o som, vindos do estado da física.
9. Um quarto de milha é completado só com acelerador e pedidos de troca.
10. Os adversários usam o mesmo modelo e os mesmos comandos, sem trocas instantâneas.

## Ponta a ponta (Playwright)

```bash
npm run test:e2e
```

```bash
npm run test:e2e:build
```

- **Ambiente:** os testes rodam no Microsoft Edge instalado no sistema (`channel: 'msedge'`), sem baixar navegador, em uma porta separada (5180).
- **Alvo:** `test:e2e` usa o servidor de desenvolvimento. `test:e2e:build` define `E2E_BUILD=1` e testa o **build de produção** (`vite build` + `vite preview`).
- **Erros:** todo teste falha se houver qualquer erro de console ou exceção não tratada na página.

| Teste | O que verifica |
|---|---|
| inicialização e áudio | libera o áudio, cria o AudioWorklet e transmite quadros da física |
| condução só com W/E/Q | não há tecla de embreagem nem de freio; o carro anda e troca marchas |
| corrida contra a IA | árvore, resultados (RT, parciais, ET, trap, marchas, rotação máx., patinagem) e recorde salvo no IndexedDB |
| editor do Sandbox | validação em português; uma mudança válida é aplicada |
| dinamômetro | varredura em plena carga medida e exportação CSV |
| seleção, motor, pausa, foco, reinício | troca de carro; desligar e religar; pausa congela o relógio; perda de foco solta o pedal; reinício volta à linha; custo por passo < 2 ms |
| presets | salvar, recarregar a página, carregar de volta, duplicar |
| vazamento de vozes | após várias trocas de modo e carro, o número de vozes de áudio vivas volta sempre a 1 ou 2 |
| pista, botões, HUD, configurações | condição inválida recusada e válida aplicada ao vivo; condução só pelos botões na tela; HUD de distância e tempo; configurações persistem após recarregar |
| editor e Developer Lab | arquitetura mantém a configuração válida; restaurar padrão; aba Testes; contadores medidos; estimativa de áudio rotulada; `T` oculta o painel |

O teste "seleção, motor..." anexa ao relatório o custo medido de um passo de física no navegador.

## Ferramentas de medição

```bash
npm run bench
```

Mede no Node, em um thread:

- **física:** o tempo de parede de um passo de 1/120 s por veículo, durante um quarto de milha em plena carga com a IA avançada;
- **áudio:** o tempo de CPU para renderizar 1 s por voz, em qualidade alta e baixa.

Os números são impressos como medidos nesta máquina; o navegador acrescenta custos de renderização e agendamento.

```bash
npm run calibrate:audio
```

Roda a física real em marcha lenta, aceleração livre e passada em plena carga, renderiza a voz e relata:

- RMS e pico por canal e por fase;
- custo relativo ao tempo real;
- resets por valores não finitos.

Com `--wav <pasta>`, grava a mixagem em WAV. Foi assim que as escalas `CHANNEL_NORM` foram escolhidas.

```bash
npm run assets
```

Exporta os sprites SVG procedurais (carroceria e roda) de cada carro e um `manifest.json` com tamanhos e pontos de ancoragem físicos, em `dist-assets/sprites`.

## Checagem de tipos e build

```bash
npm run build
```

`npm run build` executa `tsc --noEmit` antes do `vite build`. Um erro de tipo impede o build.
