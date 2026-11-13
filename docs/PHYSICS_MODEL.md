# Modelo físico

Unidades SI em todo o código, salvo indicação: m, s, kg, N, N·m, rad/s, Pa, K. A interface converte para rpm, km/h, cv e °C apenas na exibição.

## 1. Integração

- **Esquema:** passo fixo `h = 1/120 s`, Euler semi-implícito. As velocidades são atualizadas pelas forças do passo e as posições pelas novas velocidades.
- **Graus de liberdade** do modelo longitudinal:

  | Grau de liberdade | Inércia |
  |---|---|
  | ω_e, virabrequim | `engine.inertiaKgM2` + inércia de entrada do câmbio |
  | ω_w, linha de tração | rodas motrizes + saídas refletidas: I_w = 2·I_roda + I_saída·i_final² |
  | v, carroceria | massa + inércia das rodas livres / r² |

- **Acoplamentos:** embreagem, pneu, freios, atrito do motor, motor de partida, dinamômetro e resistência ao rolamento são **restrições de velocidade com limites**, resolvidas juntas por Gauss–Seidel projetado (`ConstraintSolver`):

  ```
  v⁺ = v* + h·M⁻¹·Jᵀ·λ,     J·v⁺ + cfm·λ = bias,     lo ≤ λ ≤ hi
  ```

  `λ` é a força ou o torque aplicado no passo. É assim que acoplamentos rígidos (embreagem travada, pneu aderido) ficam estáveis a 120 Hz sem passo variável. O CFM permite representar no mesmo solver uma força complacente linearizada, usada pelo pneu.
- **Testes de integração:**
  - um atrito nunca adiciona energia cinética;
  - uma restrição de atrito unilateral para o corpo exatamente em repouso, sem inversão;
  - o resultado converge quando o passo é reduzido;
  - **balanço de energia:** em 10 s de desaceleração livre a partir de 40 m/s, a energia cinética perdida (carroceria + rodas + linha de tração) bate com o trabalho de arrasto, rolamento, atrito viscoso da linha e escorregamento do pneu com erro de **0,23 %**. O limite do teste é 2 %.

## 2. Motor (modelo de valor médio)

Equação do virabrequim:

```
I·dω/dt = T_combustão − T_atrito − T_bombeamento − T_carga − T_acessórios
```

- **Torque indicado:**

  ```
  T_comb = T_ind,WOT(rpm) · (m_ar / m_ar,ref) · habilitação de faísca/combustível
  ```

  A curva indicada em plena carga é a **curva de torque efetivo configurada mais as perdas modeladas**. Assim, em plena carga e condições padrão, o torque *líquido* reproduz a curva configurada. A potência nunca é imposta: P = T·ω. No dinamômetro, os picos medidos ficam entre 0,02 % e 0,05 % da curva nos motores aspirados.
- **Reta de Willans:** o torque indicado cruza zero a 10 % de carga (`WILLANS_OFFSET`), reproduzindo a queda de eficiência em carga parcial.
- **Coletor (speed-density):**

  ```
  dp/dt = (R·T/V_col)·(ṁ_borboleta − ṁ_cilindros),     ṁ_cil = η_v·p·V_d·(rpm/120)/(R·T)
  ```

  Integrado implicitamente em 8 subpassos de fluido por passo de física, como no engine-sim.
- **Borboleta:** orifício compressível (vazão subsônica ou estrangulada) portado do `GasSystem::flowRate` do engine-sim.
  - Área efetiva: `C_d·A·cos(posição_placa·π/2)`, com C_d = 0,82.
  - O atuador é de primeira ordem (`throttle.responseTimeS`) e o pedal segue a lei `s^γ` (DirectThrottleLinkage).
- **Ar ambiente:** pressão e temperatura da pista entram na densidade do ar de admissão e no arrasto: ρ = p/(R·T).
- **Atritos:**
  - Coulomb, acessórios e bombeamento formam uma restrição de atrito limitada (RotationFrictionConstraint);
  - o atrito viscoso é explícito;
  - a média é calibrada por FMEP de Chen–Flynn.
- **Ignição:** port do `IgnitionModule` do engine-sim.
  - Tabela de ângulos de ignição em 720°, que define a ordem de ignição e o espaçamento irregular, como no V8 cross-plane.
  - Detecção dos eventos cruzados em cada passo; vários cilindros podem disparar em um passo de 8,3 ms.
  - Limitador de giro por tempo com histerese.
  - Corte de faísca parcial nas trocas.
- **Motor de partida e marcha lenta:**
  - O motor de partida é uma restrição de velocidade limitada em torque.
  - O controle de marcha lenta usa abertura base, PI com alocação de polos, termo derivativo que compensa o atraso do coletor e dashpot.
- **Corte de combustível em desaceleração:** com histerese, com o pedal solto e rpm > marcha lenta + 1200.
- **Turbo (ordem reduzida, não é CFD nem mapa de compressor):**
  - O eixo segue um atraso de primeira ordem até um alvo ∝ √ṁ_escape.
  - A pressão do compressor é ∝ (rotação do eixo)².
  - A wastegate limita o boost máximo.
  - A válvula de alívio (BOV) ventila ao fechar a borboleta.
  - Consequência física visível no dinamômetro: em baixa rotação a vazão de escape não basta para o boost total, e a curva medida fica abaixo da configurada (até 8,9 % no Orion a 1000 rpm). O status do dinamômetro explica isso; não é um erro.

## 3. Embreagem e câmbio semiautomático

- **Embreagem:** restrição limitada:

  ```
  |T_embreagem| ≤ T_max · acoplamento
  ```

  Travada, ela transmite o necessário; patinando, transmite no máximo a capacidade, e o resto vira calor (escorregamento × torque).
- **Controlador automático** (`AutomaticClutchController`): só decide o acoplamento. Estados:

  | Estado | O que faz |
  |---|---|
  | OPEN | neutro ou nada a transmitir |
  | LAUNCH | segura o motor perto de `clutch.launchRpm` patinando, e trava quando as velocidades se aproximam |
  | SHIFT | o sequenciador de trocas controla as rampas |
  | LOCKED | totalmente acoplada |
  | ANTI_STALL | abre a embreagem quando o carro para engatado, para o motor não morrer |

- **Sequenciador de trocas** (`ShiftController`): `IDLE → TORQUE_CUT → CLUTCH_DISENGAGE → GEAR_CHANGE → REV_MATCH → CLUTCH_ENGAGE → COMPLETE`, com durações configuráveis. Valores típicos: 35 ms de corte, 30 ms para abrir, 60 ms de engate e 110 ms para fechar.
  - **Nada escreve a rotação.** Na subida ela cai pela inércia do motor, com borboleta fechada e corte de faísca. Na redução, um controlador proporcional com horizonte de previsão dá a "punta-taco" (blip).
  - **Reduções que estourariam o giro** (acima de 97 % do limitador) são recusadas e o HUD avisa. Com `overRevProtection: 'wait'`, a redução fica pendente até a rotação permitir.
  - **Pedidos durante uma troca** ficam em um buffer de um slot, revalidado ao fim da troca.
- **Câmbio:** `ω_disco = G·ω_roda`, com G = relação × diferencial. O torque na roda é G·T_embreagem, menos a perda de engrenamento: uma restrição de atrito proporcional ao torque, com eficiência configurável.

## 4. Pneu e veículo

- **Magic Formula longitudinal:**

  ```
  F = N·D·sin(C·atan(B·κ − E·(B·κ − atan(B·κ)))),     D = μ_pico·aderência·f(T_pneu)
  κ = (ω·r − v) / max(|v|, 2 m/s)
  ```

  - O pico de κ fica na faixa realista de 8–20 %, coberta por teste.
  - Para o passo implícito, a força é linearizada pela inclinação secante quando o pneu passa do pico. Assim o termo continua dissipativo, e o excesso de torque ainda acelera a roda: a patinagem é uma "fuga" física, não um efeito bloqueado.
- **Temperatura do pneu:** concentrada, de primeira ordem. A potência de escorregamento aquece e a convecção resfria até a temperatura do asfalto. A aderência cai linearmente longe da temperatura ótima. É simplificado e calibrado, não um modelo térmico de pneu.
- **Transferência de carga:**
  - Alvo `m·a·h_CG/L`, seguido por uma suspensão equivalente mola-amortecedor (≈ 1,6 Hz, ζ ≈ 0,7).
  - A carga normal em cada eixo é estática ± transferência, com mínimo de 4 %.
  - O ângulo de arfagem desenhado é proporcional à transferência, limitado a ±0,06 rad.
- **Resistências:**

  ```
  F_aero = ½·ρ·C_x·A·v_rel·|v_rel|     com v_rel = v − vento
  F_rol  = C_rr·fator_pista·N
  F_rampa = m·g·sin(atan(inclinação))
  ```

  A linha de tração tem arrasto viscoso de 0,015 N·m·s/rad.
- **Freios:** não há tecla de freio. Os freios atuam só automaticamente:
  - na linha de largada, segurando o carro até o piloto acelerar;
  - depois da chegada ou perto do fim da pista, desacelerando a ≈ 0,55 g, limitado pela aderência e pelo torque de freio configurado.

## 5. IA

A IA usa o **mesmo** `VehicleSimulation` e os mesmos comandos do jogador: pedal, subir e descer marcha. Não há embreagem nem trocas instantâneas.

- **Pontos de troca:** calculados a partir da curva de torque. Para cada marcha, é a rotação em que a força na roda da marcha seguinte passa a ser maior na mesma velocidade.
- **Níveis:**

  | Nível | Reação média | Controle de tração | Desvio do ponto de troca | Chance de queimar a largada |
  |---|---|---|---|---|
  | iniciante | 0,42 ± 0,12 s | nenhum | −650 ± 350 rpm | 5 % |
  | intermediário | 0,27 ± 0,06 s | κ alvo 1,8 × pico, 85 % da força, 12 Hz | −250 ± 150 rpm | 2 % |
  | avançado | 0,16 ± 0,025 s | κ alvo 1,0 × pico, 100 %, 60 Hz | −40 ± 40 rpm | 0 % |

- **Aleatoriedade:** vem de um PRNG com semente. A mesma semente reproduz a mesma corrida.

## 6. Corrida

- **Feixes:** pré-estágio e estágio. A largada é registrada quando a frente do carro cruza o *rollout* de 0,29 m.
- **RT:** saída do feixe − verde. RT negativo é queima de largada (luz vermelha).
- **Árvore:** pro (verde 0,4 s depois de acender) ou sportsman (âmbar em sequência, verde a 1,5 s).
- **Parciais:** 60, 330 e 1000 ft, 1/8 e 1/4 de milha e 1 km, contadas a partir da saída do feixe.
- **Trap:** velocidade média nos 66 ft antes da linha.
- **Interpolação:** cruzamentos interpolados linearmente dentro do passo.
- **DNF:** 45 s após o verde sem chegar.
- **Estatísticas por faixa,** capturadas na linha de chegada: marchas usadas, rotação máxima e patinagem acumulada ∫|ωr − v| dt. A patinagem conta desde o início da corrida, incluindo o estágio.

## 7. Parâmetros configuráveis

Todos os parâmetros de carro e pista estão no esquema zod (`src/data/schema.ts`), com faixas e validações cruzadas, como:

- a ordem de ignição é uma permutação de 1..n;
- a marcha lenta é menor que metade da faixa vermelha;
- a biela mede pelo menos 1,3 × o curso;
- os balanços são coerentes com o comprimento.

O editor do Sandbox expõe esses mesmos parâmetros e mostra a cilindrada calculada (π/4·D²·S·n).

## 8. Hipóteses principais

- Modelo **longitudinal 1-D**: sem dinâmica lateral, esterçamento ou rolagem. A arfagem é derivada da transferência de carga.
- O motor é de **valor médio**: o torque é médio por ciclo, sem pulsação por cilindro na física. A pulsação existe só no som, que lê o ângulo do virabrequim.
- O diferencial é aberto e equivalente a um eixo; as duas rodas motrizes são tratadas como uma.
- O combustível tem composição fixa e não há modelo de detonação.

Mais em [LIMITATIONS.md](LIMITATIONS.md).
