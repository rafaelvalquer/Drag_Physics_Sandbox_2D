# Modelo acústico

Todo o som é sintetizado em tempo real, sem amostras gravadas. A entrada é o estado da física, passo a passo: ângulo e velocidade do virabrequim, carga, pressões, eventos de ignição, corte de faísca, turbo, patinagem, embreagem e marcha. A geometria usada pelo som (cilindros, ordem de ignição, comando de válvulas, escapamento) é a **mesma** configuração do carro usada pela física (`carToAcousticConfig`), não uma cópia separada.

O som roda em um AudioWorklet (`vehicle-audio.worklet.ts`), com uma voz por veículo e sete saídas mono:

| Canal | Fontes |
|---|---|
| admissão | runner + ressonador de Helmholtz da caixa de ar, chiado da borboleta |
| bloco | forças de inércia, ruído de combustão, ressonâncias estruturais, batidas de válvula, motor de partida |
| escape | rede de guias de onda (coletores, câmaras do abafador, ponteira) |
| turbo | assobio do compressor, chiado, válvula de alívio, surge |
| pneus | chiado de patinagem, ronco de rolagem |
| transmissão | assobio de engrenagens, patinagem da embreagem, batida de engate |
| ambiente | vento |

## 1. Do passo de física para a amostra de áudio

A física roda a 120 Hz e o áudio a 44,1 ou 48 kHz. O `TelemetryStream` reconstrói um sinal de controle por amostra:

- **Buffer de jitter:** a reprodução fica 50 ms atrás do quadro mais novo. A taxa do relógio de reprodução varia no máximo ±2 % para manter essa latência apesar da deriva entre o laço de renderização e o relógio de áudio. Os valores contínuos são interpolados linearmente entre quadros.
- **Fase do virabrequim:** integrada a partir de ω no próprio thread de áudio, para ter fase contínua, com um PLL suave em direção ao ângulo da física. A correção fica limitada a poucos % da velocidade, então nunca há salto audível.
- **Valores discretos** (marcha, corte de faísca, combustão habilitada): vêm do quadro anterior ao instante de reprodução. Eventos únicos, como estouro no escape, disparam uma vez.
- **Perda de telemetria:** o último quadro é mantido e o som some com fade. Quando os quadros voltam, o fluxo ressincroniza sob o fade.
- **Quadros inválidos:** quadros com valores não finitos são descartados e contados.

## 2. Fonte por cilindro

**Origem:** `Cylinder` e `Engine` do engine-sound-generator (MIT), com uma fonte por cilindro defasada pela ordem de ignição no ciclo de 720°. **Mudança principal:** o original usava um pulso de pressão analítico fixo com jitter de fase aleatório. Aqui:

- **Válvulas:** as curvas de levantamento saem dos tempos do comando (EVO/EVC/IVO/IVC, em graus a partir do PMS de ignição), os mesmos dados da configuração do motor.
- **Blowdown do escape:** um pequeno modelo de dinâmica de gases por cilindro.
  - **Pressão na abertura (EVO):** estimada a partir da carga aprisionada, da taxa de compressão e da expansão politrópica até o volume de EVO. Com combustão, inclui a liberação de calor; com corte de faísca, limitador ou ignição desligada, usa o valor motorado, sem combustão.
  - **Com a válvula aberta:**

    ```
    dp/dt = −γ·p·(dV/dt + u)/V,     u = C_d·A_válvula·L(θ)·c·√(2Δp/(γ·p))   (limitado à vazão estrangulada)
    ```

    Δp é medido contra a pressão no coletor junto à porta, então os pulsos de cilindros vizinhos interagem (lavagem). A onda que entra no coletor é ρc·u/A_coletor.
- **Admissão:** o pistão aspira pela válvula de admissão aberta. A vazão excita um runner físico (guia de onda) e a ressonância de Helmholtz da caixa de ar, f = c/2π·√(A/(V·L)).
- **Bloco:**
  - forças de inércia alternativas `m·r·ω²·(cos α + λ·cos 2α)` projetadas no eixo de cada bancada;
  - subida de pressão da combustão (taxa de liberação de calor de Wiebe ao longo da duração da queima);
  - o primeiro modo acústico circunferencial da câmara, f = 1,841·c/(π·D);
  - três ressonâncias estruturais escaladas pelo tamanho do motor (∝ cilindrada^−1/3);
  - batidas de fechamento de válvula e o zumbido do motor de partida.
- **Variação ciclo a ciclo da combustão:** vem de um PRNG com semente. A renderização é determinística, o que permite testá-la.

## 3. Rede de escapamento (guias de onda)

**Origem:** `DelayLine`, `Waveguide` e a cadeia cilindro → coletor → tubo → `Muffler` (elementos em paralelo) → saída, do engine-sound-generator. Coeficientes de reflexão dependentes da válvula, de `Cylinder.updateWaveguidesReflectionValues`.

**Mudanças:**

- **Comprimentos físicos em metros:** atraso = L / c(T) · fs, com c = √(γ·R·T) do gás no tubo e a taxa de amostragem **real** do AudioContext. O original usava contagens de amostras ajustadas para 44,1 kHz.
- **Atraso fracionário** com interpolação linear: o comprimento acompanha a temperatura do gás sem cliques. No original, o comprimento era fixo.
- **Junções:** de espalhamento N-portas sem perdas, ponderadas pelas áreas dos tubos. Mudanças de área (câmara de expansão, ponteira) refletem com o sinal fisicamente correto.
- **Topologia:** um primário por cilindro e um coletor por bancada, com junção em Y (layout simples) ou duas linhas independentes (layout duplo). As câmaras do abafador são tubos em paralelo, e há um ressonador de quarto de onda fechado opcional.
- **Perdas de propagação:** perda de parede em banda larga (dB/m) e um passa-baixas termoviscoso de um polo por sentido. O original não tinha perdas e dependia apenas de reflexões menores que 1.
- **Saída aberta da ponteira:** as baixas frequências refletem invertidas e as altas irradiam. A divisão é um polo em ≈ 0,3·c/(2πa). A parte irradiada é a saída do canal.
- **Temperatura do gás:** a temperatura de escape (EGT) da física, com resfriamento ao longo do tubo, define a velocidade do som em cada segmento.
- **Estouros no escape:** combustível não queimado que se inflama no escape quente. São eventos da física (limitador ou início de corte de torque com escape quente, com probabilidade) e são injetados como pressão no início da ponteira.
- **Presets** `stock`, `sport` e `straight`: mudam geometria (comprimentos, logo atrasos; diâmetros, logo reflexões), câmaras e absorção, ou seja, a **resposta acústica**, e não só o volume.

## 4. Fontes auxiliares (código novo)

- **Turbo:**
  - assobio de passagem das pás f = N_eixo/60 · nº de pás, desligado com fade antes de Nyquist para nunca gerar aliasing;
  - chiado do compressor ∝ boost;
  - ruído de alívio da BOV ∝ vazão da válvula;
  - flutter de surge quando não há BOV.
- **Pneus:** chiado de patinagem (stick–slip, ruído de banda estreita) a partir da velocidade de escorregamento e da carga das rodas motrizes; ronco de rolagem ∝ v^1,5.
- **Transmissão:**
  - assobio de engrenamento na rotação do eixo de entrada × dentes, ∝ √|torque|;
  - ruído de patinagem da embreagem ∝ potência dissipada;
  - batida de engate na troca.
- **Vento:** ∝ v², com espectro dependente da velocidade.

Acumuladores de fase mantêm todos os tons contínuos quando a frequência muda.

## 5. Mixagem e espacialização

- **Escala por canal (`CHANNEL_NORM`):** mapeia os níveis físicos (Pa) para a faixa digital. Foi calibrada uma vez com `npm run calibrate:audio` para que um carro típico em plena carga perto do limite fique abaixo de ≈ 0,5 por canal.
  - Os **níveis relativos** entre carros, presets e pontos de operação vêm do modelo.
  - Saem do modelo também o **timbre** e as **diferenças entre arquiteturas**.
  - O **nível absoluto** não sai do modelo: é escolha de escala.
- **Mixer:** cada canal tem um `GainNode` próprio, ajustável na interface.
- **Espacialização** (caminho Doppler portado do `sound_generator_worklet.js`):
  - atraso de propagação = distância/343 m/s em um `DelayNode` com rampas lineares, de onde vem o efeito Doppler;
  - atenuação 6 m / max(6 m, d);
  - pan de potência constante a partir do deslocamento lateral.

  O ouvinte acompanha o carro do jogador a 7 m da pista. O escape do lado oposto tem um caminho extra (≈ 1,45 m) e a sombra da carroceria (um passa-baixas).
- **Proteções:** bloqueador de DC e *soft clip* na saída de cada voz. Os filtros descartam valores denormais. `process()` não aloca memória.
- **Qualidade baixa:** sem runner de admissão, linha de escape única, no máximo 2 câmaras, sem ressonador e sem batidas de válvula. O tom é o mesmo; a economia medida é pequena, de 8 % a 21 % conforme o carro.

## 6. O que é validado matematicamente

Tudo isto tem teste automatizado (`tests/unit/audio/acoustics.test.ts`):

- **Periodicidade:** o sinal é periódico no ciclo do motor, com fundamental = frequência de ignição / k, para cada arquitetura a 44,1 e 48 kHz.
- **Tom:** o fundamental acompanha a rotação; de 2000 para 4000 rpm, o tom dobra.
- **Independência da taxa de amostragem:** mesmo tom, nível e equilíbrio espectral a 44,1 e 48 kHz.
- **Caráter da ordem de ignição:**
  - o V8 cross-plane tem conteúdo forte de meia ordem e ordens ímpares, e o flat-plane não;
  - trocar a ordem de ignição muda o som.
- **Corte de faísca:**
  - o corte total reduz o escape e quase silencia o ruído de combustão;
  - o corte parcial suprime a fração comandada de eventos.
- **Carga e escapamento:**
  - plena carga é mais alta que carga parcial na mesma rotação;
  - os presets mudam a forma do espectro, não só o volume.
- **Robustez:**
  - quadros não finitos são rejeitados;
  - a saída fica finita e limitada sob telemetria aleatória;
  - uma varredura suave de rpm não gera cliques;
  - o fade na perda de telemetria e a volta funcionam sem estalo;
  - um reset da simulação (tempo voltando) ressincroniza sob fade.
- **Independência e determinismo:**
  - duas vozes juntas são bit a bit iguais a cada uma sozinha;
  - a mesma semente renderiza igual e outra semente difere.
- **Qualidade baixa:** mantém o tom.
- **Integração com a física:** partida, marcha lenta, largada e troca dão saída finita, queda do ruído de combustão na troca e a batida de engate.
- **Custo:** medido no Node (`npm run bench`), entre 5,6 % e 11 % de um núcleo por voz.

## 7. O que exigiria calibração com medições reais

Não houve comparação com gravações de carros reais. Os itens abaixo são estimativas fisicamente motivadas, não valores medidos:

- **Níveis absolutos:** em dB SPL de cada fonte e entre fontes (bloco × escape × admissão). O equilíbrio entre canais vem das escalas de `CHANNEL_NORM`.
- **Absorção dos abafadores, perda de parede e radiação da ponteira:** a radiação é um modelo de um polo, não a impedância de radiação completa de um pistão em tubo.
- **Ressonâncias estruturais do bloco:** frequências e fatores Q escalados por tamanho, não medidos.
- **Parâmetros de Wiebe e variação ciclo a ciclo:** valores típicos da literatura.
- **Turbo, pneus, transmissão e vento:** níveis e espectros escolhidos para soar plausíveis; não há medição de referência.
- **EGT e seu resfriamento ao longo do tubo:** modelo simples de primeira ordem.
- **Ambiente:** não há reverberação nem reflexões do chão ou de muros, e a diretividade não é modelada.

Ver também [LIMITATIONS.md](LIMITATIONS.md).
