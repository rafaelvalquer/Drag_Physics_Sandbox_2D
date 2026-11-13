# Limitações conhecidas

Esta lista é intencionalmente franca: diz o que o modelo **não** faz e onde os números são estimativas.

## Física

- **Modelo longitudinal 1-D:**
  - não há dinâmica lateral, esterçamento, rolagem nem desvio de faixa;
  - a arfagem desenhada é derivada da transferência de carga, não de uma suspensão completa;
  - as duas rodas motrizes são um único grau de liberdade, com diferencial aberto equivalente;
  - não há diferencial autoblocante nem patinagem desigual entre as rodas.
- **Motor de valor médio:**
  - o torque é médio por ciclo; a pulsação por cilindro existe só no som;
  - a **curva de torque é um dado de entrada**. Trocar a arquitetura no editor (I4 → V8, por exemplo) muda ordem de ignição, ângulos, som e inércias, mas não a curva. Para mudar o torque, edite a curva.
- **Pressão no coletor com borboleta fechada:** sai baixa demais, ≈ 6 kPa a 3000 rpm no dinamômetro; motores reais ficam entre 15 e 25 kPa. O modelo não tem refluxo de gás residual nem vazamento pela borboleta além do batente de lenta. Isso afeta o freio-motor e o som de desaceleração, mas não o desempenho em plena carga.
- **Turbo de ordem reduzida:**
  - não há mapa de compressor nem de turbina;
  - em baixa rotação no dinamômetro, a curva medida fica abaixo da configurada: até 8,85 % no Orion XR e 6,69 % no Vetra RS. Isso é consequência física do enchimento, não erro do dinamômetro, mas significa que a curva configurada não é atingida em toda a faixa.
- **Pneu:** Magic Formula longitudinal com temperatura concentrada. Não há modelo térmico de camadas, desgaste, pressão de enchimento nem deformação de banda para arrancada.
- **Tempo de reação (RT):** não existe freio nem *two-step*. Por isso o RT inclui o tempo de o motor subir da marcha lenta e de a embreagem automática acoplar. Os RTs são realistas para a condição "acelerar no verde", não para pilotos de arrancada com o motor já na rotação de largada.
- **Combustível e ar:** o combustível e a mistura são fixos, e não há detonação, umidade nem variação de octanagem.

## Áudio

- **Calibração:** o modelo acústico **não foi calibrado com gravações reais**. Níveis absolutos, equilíbrio entre canais, absorção dos abafadores, ressonâncias do bloco, turbo, pneus e vento são estimativas plausíveis. Ver [ACOUSTIC_MODEL.md](ACOUSTIC_MODEL.md) §7.
- **Ambiente acústico:** não há reverberação, reflexão do chão ou de muros, nem diretividade da ponteira.
- **Sem WebAssembly:** o DSP é TypeScript puro. O custo medido no Node é de 5,6 % a 11 % de um núcleo por voz, suficiente para os dois carros. A versão WASM do projeto original não foi portada.
- **Qualidade baixa:** economiza pouco, de 8 % a 21 % conforme o carro, porque o custo dominante, as fontes por cilindro, é o mesmo nas duas qualidades.
- **Carga do thread de áudio:** **não é mensurável** pelo navegador. O Developer Lab mostra isso explicitamente e oferece só uma estimativa, renderizando 1 s no thread principal, rotulada como tal.
  - `AudioContext.playoutStats`, que mede quedas de áudio, só aparece nos navegadores que o expõem.

## Medições no navegador

- **Custo de um passo de física:** é medido com `performance.now()`, cuja resolução os navegadores reduzem por segurança. Médias em muitos passos são confiáveis, mas o valor de um passo isolado não é. A aba Testes do editor não mostra esse número por isso.
- **Quadros longos:** quadros acima de 0,25 s, como uma aba em segundo plano, não são simulados. O tempo descartado é informado no Developer Lab e no CSV.

## Visual

- **Efeitos cosméticos:** vibração em marcha lenta, pulsos de fumaça no escape, poeira no deserto, marcas de pneu e brilho das luminárias são derivados do estado físico (rotação, carga, patinagem), mas são **apenas visuais**: não alimentam a física.
- **Arte e carros:** a arte é procedural e simples. Os carros são silhuetas geradas a partir das dimensões reais, não modelos detalhados.

## Plataforma

- **Navegadores testados:** os testes E2E rodam apenas no Microsoft Edge (Chromium). Firefox e Safari não foram testados de forma automatizada. AudioWorklet e IndexedDB são necessários; sem IndexedDB, os dados ficam só na sessão, com aviso.
- **Toque:** os botões na tela foram testados com eventos de ponteiro emulados, não em aparelhos reais.
- **Telemetria:** a gravação guarda no máximo 120 s em anel. As amostras sobrescritas são contadas e declaradas no CSV.
- **Desvios da estrutura de pastas:** as pastas `src/audio/acoustics`, `src/audio/wasm`, `src/game/effects`, `src/game/tracks` e `src/sandbox` previstas na especificação não existem. O código correspondente está em `src/audio/dsp`, `src/game/scenes`, `src/data/tracks`, `src/modes/SandboxMode.ts`, `src/ui/editor` e `src/ui/DevLab.ts`. Também não há `public/assets`: não existem arquivos estáticos, porque gráficos e sons são gerados por código.
