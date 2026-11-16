# Testes

Os testes usam o código real: a mesma física, o mesmo modelo acústico e a mesma aplicação no navegador. A única substituição é o IndexedDB nos testes unitários, feito com `fake-indexeddb`.

## Unitários e de integração (Vitest)

```bash
npm test
```

| Arquivo | O que verifica |
|---|---|
| `tests/unit/core.test.ts` | cv = W/735,49875; rpm ↔ rad/s; densidade do ar e velocidade do som pela lei dos gases; distâncias oficiais; filtro de primeira ordem exato; interpolação cúbica monotônica sem overshoot; PRNG determinístico |
| `tests/unit/data.test.ts` | os seis carros fictícios do plano, o Gol GTS 1988 e as quatro pistas; tabelas de ignição cobrindo 720° com cada cilindro uma vez; mensagens de validação legíveis; cópia profunda independente |
| `tests/unit/input.test.ts` | exatamente três ações de condução (sem embreagem, sem freio); troca dispara uma vez por toque, sem repetição; pedal progressivo (≈ 0,09 s para subir, ≈ 0,07 s para descer); perda de foco solta o acelerador; remapeamento com conflitos e teclas reservadas |
| `tests/unit/storage.test.ts` | criação e leitura do IndexedDB; migração v1 → v2 sem perda; fallback em memória; configurações validadas campo a campo; atalhos com conflito rejeitados |
| `tests/unit/race.test.ts` | IA estagia sozinha e termina; árvore pro (0,4 s) e sportsman (0,5 s por âmbar); RT = saída do feixe − verde, parciais interpoladas e coerentes; queima de largada perde; DNF por tempo; frenagem automática depois da chegada |
| `tests/unit/physics/solver.test.ts` | travamento com conservação do momento; capacidade limitada durante a patinagem; atrito nunca adiciona energia; parada exata sem inversão; CFM equivale a amortecedor 1/cfm |
| `tests/unit/physics/engine.test.ts` | geometria e cilindrada; limitador com histerese (port do engine-sim); partida, marcha lenta e morte do motor sob carga; carga parcial < plena carga; freio-motor; limitador em plena carga; enchimento do turbo e BOV; entradas aleatórias; convergência com o passo; quadro de telemetria coerente |
| `tests/unit/physics/vehicle.test.ts` | Magic Formula (crescimento, pico μ·N, queda, simetria); pico de κ entre 8 e 20 %; linearização dissipativa; desaceleração livre = arrasto + rolamento; **balanço de energia** (resíduo 0,23 %, limite 2 %); transferência de carga; patinagem e aquecimento do pneu em baixa aderência |
| `tests/unit/physics/semiauto.test.ts` | os **dez testes** da alteração do plano (ver abaixo) e a frenagem automática depois da chegada |
| `tests/unit/audio/acoustics.test.ts` | tom e periodicidade por arquitetura a 44,1 e 48 kHz; independência da taxa de amostragem; caráter cross-plane × flat-plane; ordem de ignição; corte de faísca total e parcial; carga; presets de escapamento; robustez (não finitos, telemetria aleatória, cliques, perda e reset); determinismo; qualidade baixa; integração com a física. Detalhes em [ACOUSTIC_MODEL.md](ACOUSTIC_MODEL.md) |
| `tests/unit/visual.test.ts` | lógica da camada visual: um desenho por carro; metadados visuais iguais à geometria física; para-lamas livres dos pneus; estágios de desfoque das rodas sem transparência; suspensão visual (mola amortecida, troca de marcha, independência da taxa de quadros); condição de fumaça; câmera (enquadramento, zoom, sem saltos, limites, adversário e árvore em quadro); iluminação; escala do conta-giros por motor; luzes de troca por carro; indicador de marcha |
| `tests/unit/vehicles/vw-gol-gts-1988.test.ts` | os **15 testes de aceitação** do Gol GTS 1988 (AP 1.8S original): listas de carros; dimensões e massa do manual; sprite próprio; 1781 cm³; 146 N·m a 3200 rpm e 99 cv a 5600 rpm medidos no dinamômetro; acelerador; mesma curva no dinamômetro e na corrida; 5 marchas e diferencial 4,11; trocas só com W/E/Q; tração dianteira e rodas pela velocidade física; ordem 1-3-4-2 e frequência de ignição no som; canal turbo em silêncio; 0–80/100/120 km/h, 400 m, 1000 m e velocidade máxima a menos de 5 % do manual; procedência dos dados. Ver [vehicles/vw-gol-gts-1988.md](vehicles/vw-gol-gts-1988.md) |
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

### Testes visuais

`tests/e2e/visual.spec.ts` roda o jogo real, salva capturas em `visual-captures/` (fora do git) e confere a geometria lida do próprio renderizador. Não compara pixels: as capturas são a evidência para inspeção.

| Cenário | O que verifica |
|---|---|
| garagem | prévia grande, ficha técnica, pintura e luzes; a escolha chega à pista |
| sandbox | parado; sem fumaça ao acelerar em ponto morto; largada com fumaça, marcas e frente levantada; troca; rodas borradas em velocidade; parallax; desaceleração |
| pistas e iluminação | as quatro pistas, dia, fim de tarde e noite |
| resoluções e perfis | 1920 × 1080 até 390 × 844; perfis baixo, médio e alto; HUD dentro da cena |
| corrida | duas faixas, árvore pelo estado real, verde, chegada e luz de freio |
| dinamômetro | carro na célula, rodas girando com o motor, curva medida |
| vazamento | número de texturas estável ao repetir trocas de carro e pista |

Em todos vale: sprite nunca esticado, comprimento na tela igual ao real × escala da câmera, pneus sobre a linha do solo, eixos a um entre-eixos de distância. O cenário do sandbox também registra a taxa de quadros medida.

`tests/e2e/artsheet.spec.ts` salva a folha de contato da arte dos carros (`?artsheet`).

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

Exporta as nove camadas SVG da arte de cada carro (assoalho, carroceria, brilhos, luzes, freio, sombra, cubo dianteiro, cubo traseiro e roda) e um `manifest.json` com os metadados visuais, em `dist-assets/sprites`. É o mesmo gerador usado pelo jogo.

```bash
npm run calibrate:vehicle
```

Roda o teste de aceleração de fábrica ([src/game/race/accelerationTest.ts](../src/game/race/accelerationTest.ts)) com a física real e a IA avançada:

- **condições:** motor ligado, 1ª engatada, plena carga, relógio a partir do primeiro movimento;
- **saída:** imprime 0–80/100/120 km/h, 400 m, 1000 m, velocidade máxima, trocas, patinagem e a carga no eixo motriz;
- **metas:** para o Gol GTS 1988, compara com o manual.

Só mede, não altera o carro. Com `-- <id-do-carro> [id-da-pista]` mede outro carro ou outra pista.

## Checagem de tipos e build

```bash
npm run build
```

`npm run build` executa `tsc --noEmit` antes do `vite build`. Um erro de tipo impede o build.
