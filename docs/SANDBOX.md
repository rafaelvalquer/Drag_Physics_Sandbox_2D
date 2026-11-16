# Sandbox

O Sandbox é o modo principal: um carro em uma pista de 1,6 a 2 km, sem árvore nem cronômetro oficial, com todos os parâmetros abertos.

- **Seleção:** carro e pista são escolhidos no topo do painel. Trocar qualquer um reinicia a simulação. O botão **Garagem**, no topo da tela, mostra os carros em detalhe e também troca a pintura.
- **Ignição:** automática ao entrar na pista. O botão **Ligar/Desligar motor** existe para testar partida e parada.
- **Fim da pista:** nos últimos 260 m, o carro freia sozinho. `R` reinicia.

## HUD

O HUD mostra o conta-giros analógico com a escala do motor escolhido, a marcha, a velocidade, as luzes de troca progressivas, o acelerador e a pressão do turbo (nos carros turbo), e também:

- **distância percorrida** e **tempo da passada:** o tempo começa no primeiro movimento e para quando o carro volta ao repouso;
- **diferença para o carro de comparação**, quando há um;
- **barra de patinagem** das rodas motrizes: fica vermelha acima de 15 % de escorregamento.

## Condições da pista

O painel recolhível **Condições da pista** permite alterar, com efeito imediato e sem reiniciar:

- aderência da superfície;
- fator de resistência ao rolamento;
- temperatura do asfalto e do ar;
- pressão atmosférica (kPa);
- vento (m/s, positivo a favor);
- inclinação (%).

Valores fora da faixa são recusados com mensagem em português e não chegam à física. **Restaurar condições da pista** volta aos valores da pista escolhida.

## Editor do veículo

O editor tem as abas **Motor**, **Câmbio**, **Pneus e chassi**, **Escapamento** e **Testes**. Cada campo tem unidade, faixa e dica, e a validação é a do esquema zod usado pela física: ordem de ignição, ângulos, relações e cruzamentos entre campos. Os erros aparecem com o nome do campo.

- **Arquitetura** (I4, I6, V6, V8 cross-plane, V12): preenche cilindros, ângulo entre bancadas, tipo de virabrequim, ordem de ignição e bancada de cada cilindro. Os ângulos de ignição são recalculados para disparo uniforme em 720°.
  - A **curva de torque não muda**, porque ela é um dado de entrada. Ajuste diâmetro e curso para a cilindrada que quiser; o valor é mostrado ao lado, calculado como π/4·D²·S·n.
- **Aplicar:** reinicia a simulação com a nova configuração.
  - **Ao vivo, sem reiniciar:** escapamento, canais de som, nome e visual entram sozinhos 300 ms depois da última edição. O som troca com crossfade.
- **Restaurar padrão:** volta aos valores de fábrica do carro, inclusive de um preset feito a partir dele. Não aplica sozinho.
- **Duplicar preset:** salva uma cópia como novo preset.
- **Exportar e importar JSON:** a importação passa pela mesma validação.
- **Testes:** leituras ao vivo do carro em pista, útil para ver o efeito de uma edição logo depois de aplicar:
  - rotação, carga, torque líquido e marcha;
  - estado e escorregamento da embreagem, estado da troca;
  - velocidade, aceleração, patinagem, força do pneu em relação ao pico e temperatura do pneu;
  - pressão absoluta no coletor;
  - condições da pista em uso.

## Comparação

**Segundo carro** coloca outro veículo na faixa ao lado. Ele é simulado com a mesma física, tem som próprio e aparece com nome na cena. Há dois pilotos possíveis:

| Piloto | Comportamento |
|---|---|
| espelhar meus comandos | recebe exatamente o mesmo pedal e as mesmas trocas do jogador, para comparar só o carro |
| IA avançada | larga quando você acelera engatado, com pontos de troca ótimos e controle de tração |

Quando o outro carro sai da tela, um indicador na borda mostra o nome e a distância em metros.

## Presets

**Presets salvos** guarda a configuração atual do editor com um nome, no IndexedDB, e cada preset pode ser carregado ou excluído.

- Os presets sobrevivem a recarregar a página.
- Se o IndexedDB não estiver disponível, como em uma janela privada em alguns navegadores, o preset fica só nesta sessão e o aviso diz isso.

## Mixer de áudio

O mixer tem um controle de volume por canal: admissão, bloco/mecânico, escape, turbo, pneus, transmissão e ambiente.

## Developer Lab (tecla `T`)

**Tempo real (carro do jogador):**

- **Mostradores:** rpm, velocidade, torque líquido, aceleração, torque da embreagem e força do pneu.
- **Três gráficos rolantes:** rpm e km/h, torque e aceleração (g), torque de embreagem e força do pneu.
- **Valores ao vivo:** marcha, estado da troca e da embreagem, patinagem, pressões e temperaturas.

**Medido:** o que é contado de verdade neste navegador:

- FPS e passos de física por quadro;
- custo médio de um passo;
- tempo real descartado (quadros acima de 0,25 s);
- estado do AudioContext e taxa de amostragem;
- estatísticas do worklet: quadros recebidos, rejeitados e resets;
- `playoutStats` do AudioContext, quando o navegador expõe.

**Estimado:** a carga do thread de áudio não é mensurável pelo navegador, e o painel diz isso. O botão **Estimar carga de áudio** renderiza 1 s do modelo acústico no thread principal, com o estado atual do motor, e mostra o resultado como % de um núcleo, identificado como estimativa.

**Controles:**

- pausar ou continuar e **Avançar 1 passo** (1/120 s);
- **solo** de um canal de som;
- **Gravar telemetria** e **Exportar CSV**.

### CSV de telemetria

Cada passo de física (1/120 s) vira uma linha com 21 colunas, até 120 s de gravação, em anel. As colunas são:

- tempo, distância, velocidade e aceleração;
- rpm, pedal, borboleta efetiva, pressão no coletor e pressão do turbo;
- torque líquido, marcha;
- comando, torque e deslize da embreagem;
- escorregamento, força e carga do pneu;
- arrasto, arfagem, estado da troca e temperatura do escape.

O cabeçalho (`#`) registra:

- modo, carro e pista;
- passo de física (1/120 s, fixo);
- número de amostras e **amostras perdidas** quando o anel enche;
- tempo real não simulado (quadros acima de 0,25 s).

A Corrida e o Dinamômetro exportam CSVs próprios: o resultado da corrida e a varredura do dinamômetro.
