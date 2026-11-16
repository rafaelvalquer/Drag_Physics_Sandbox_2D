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

## Carro real: Volkswagen Gol GTS 1988

O Gol é o único carro real. Sua fidelidade tem limites próprios, além dos do modelo; a lista completa está em [vehicles/vw-gol-gts-1988.md](vehicles/vw-gol-gts-1988.md).

- **Dados de fábrica:** só os pontos de 146 N·m a 3200 rpm e 99 cv a 5600 rpm são documentados. A forma do resto da curva de torque é calibrada.
- **Corte de rotação:** o carro original não tem corte eletrônico documentado. O limite de 6500 rpm é proteção da simulação.
- **Carburador:** o Brosol 2E de dois estágios é representado por uma borboleta equivalente com abertura progressiva. A marcha lenta mecânica e o afogador são aproximados pelo controlador de marcha lenta do modelo.
- **Embreagem e trocas:** o carro real tem pedal de embreagem. No jogo, a embreagem automática e as fases de troca são uma ajuda de condução calibrada.
- **Largada:** a tração dianteira patina bastante na largada, com escorregamento de pico perto de 200 %. A IA e a embreagem automática não modulam a largada como um piloto experiente. Por isso 0–80 e 0–100 km/h ficam 2–2,5 % acima do manual, enquanto 120 km/h, 400 m e 1000 m ficam a menos de 1 %.
- **Rotação na velocidade máxima:** sai 5667 rpm contra 5588 no manual, por causa do deslizamento do pneu em regime.
- **Fontes divergentes:** testes de imprensa da época mediram 0–100 km/h em 10,8–11 s. A meta usada é a do manual, 9,7 s.

## Áudio

- **Calibração:** o modelo acústico **não foi calibrado com gravações reais**. Níveis absolutos, equilíbrio entre canais, absorção dos abafadores, ressonâncias do bloco, turbo, pneus e vento são estimativas plausíveis. Ver [ACOUSTIC_MODEL.md](ACOUSTIC_MODEL.md) §7.
- **Gol GTS 1988:** o som segue a arquitetura real (4 cilindros, ordem 1-3-4-2, aspirado, escapamento original simples), mas não há gravações do carro. **Não se afirma identidade acústica** com o Gol real; a geometria do escapamento é calibrada, não medida.
- **Ambiente acústico:** não há reverberação, reflexão do chão ou de muros, nem diretividade da ponteira.
- **Sem WebAssembly:** o DSP é TypeScript puro. O custo medido no Node é de 5,6 % a 11 % de um núcleo por voz, suficiente para os dois carros. A versão WASM do projeto original não foi portada.
- **Qualidade baixa:** economiza pouco, de 8 % a 21 % conforme o carro, porque o custo dominante, as fontes por cilindro, é o mesmo nas duas qualidades.
- **Carga do thread de áudio:** **não é mensurável** pelo navegador. O Developer Lab mostra isso explicitamente e oferece só uma estimativa, renderizando 1 s no thread principal, rotulada como tal.
  - `AudioContext.playoutStats`, que mede quedas de áudio, só aparece nos navegadores que o expõem.

## Medições no navegador

- **Custo de um passo de física:** é medido com `performance.now()`, cuja resolução os navegadores reduzem por segurança. Médias em muitos passos são confiáveis, mas o valor de um passo isolado não é. A aba Testes do editor não mostra esse número por isso.
- **Quadros longos:** quadros acima de 0,25 s, como uma aba em segundo plano, não são simulados. O tempo descartado é informado no Developer Lab e no CSV.
- **Atraso de desenho:** para o carro andar liso na tela, ele é desenhado interpolado entre os dois últimos passos de física. A imagem fica até um passo (8,3 ms) atrás do estado simulado; o HUD, o som e a cronometragem usam o estado mais recente.
- **Medição de estabilidade:** o desvio de screenX é medido nos instantes em que a cena atualiza (`performance.now()`), não no instante exato em que o monitor exibe o quadro, que o navegador não informa.

## Visual

- **Efeitos cosméticos:** a suspensão visual, a vibração em marcha lenta, a fumaça, a poeira, as marcas de pneu, as luzes e o brilho das luminárias são derivados do estado físico (aceleração, rotação, carga, patinagem), mas são **apenas visuais**: não alimentam a física.
- **Arte gerada por código:** os carros, a pista e os cenários são ilustração vetorial semirrealista, não renderização fotorrealista. Não houve modelagem 3D nem produção artística externa. As árvores e o público das arquibancadas são estilizados e estáticos. O que uma produção externa melhoraria está em [VISUAL_SYSTEM.md](VISUAL_SYSTEM.md), seção 14.
- **Iluminação:** é feita por tingimento e sprites aditivos. Os carros não projetam sombras sobre o cenário e não há luz calculada por pixel.
- **Dinamômetro ilustrado:** a simulação é de um dinamômetro de **motor**. A imagem do carro sobre rolos é uma apresentação: as rodas e os rolos giram na rotação do motor pela marcha mais direta, só para efeito visual.
- **Carga de texturas:** as texturas de pista e cenário são geradas na thread principal ao abrir o jogo e ao trocar de pista, de iluminação ou de perfil gráfico. Isso causa uma pausa única de alguns décimos de segundo, que a simulação descarta e contabiliza como tempo real não simulado.
- **Carroceria de protótipo:** o Aurora V12 ganhou um tipo de carroceria próprio (`prototype`), acrescentado ao esquema de validação. É um campo apenas visual.
- **Gol GTS 1988:** o desenho (`golGts88`) é uma ilustração original feita com as dimensões do manual. Não foi traçado sobre fotos, e nenhuma imagem foi copiada. O logotipo da Volkswagen não é desenhado, só o emblema "GTS". A grade e os faróis retangulares não aparecem na vista lateral.

## Plataforma

- **Navegadores testados:** os testes E2E rodam apenas no Microsoft Edge (Chromium). Firefox e Safari não foram testados de forma automatizada. AudioWorklet e IndexedDB são necessários; sem IndexedDB, os dados ficam só na sessão, com aviso.
- **Toque:** os botões na tela foram testados com eventos de ponteiro emulados, não em aparelhos reais.
- **Telas pequenas:** abaixo de 760 px de largura a cena fica em cima e o painel embaixo. O layout foi verificado em 390 × 844 por captura automática, não em aparelhos reais; nesse tamanho os instrumentos ficam pequenos.
- **Telemetria:** a gravação guarda no máximo 120 s em anel. As amostras sobrescritas são contadas e declaradas no CSV.
- **Desvios da estrutura de pastas:** as pastas `src/audio/acoustics`, `src/audio/wasm`, `src/game/effects`, `src/game/tracks` e `src/sandbox` previstas na especificação não existem. O código correspondente está em `src/audio/dsp`, `src/game/scenes`, `src/data/tracks`, `src/modes/SandboxMode.ts`, `src/ui/editor` e `src/ui/DevLab.ts`. Também não há `public/assets`: não existem arquivos estáticos, porque gráficos e sons são gerados por código.
