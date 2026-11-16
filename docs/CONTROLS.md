# Controles

O câmbio é **semiautomático**. O piloto só acelera, sobe e desce marchas:

- **Embreagem:** não há tecla de embreagem. Ela é automática e simulada fisicamente: patina na largada, abre e fecha nas trocas, abre para o motor não morrer.
- **Freio:** não há tecla de freio. O carro só freia sozinho (ver abaixo).
- **Ignição:** liga sozinha ao entrar na pista. O motor de partida gira o motor até ele pegar.

## Teclado (padrão)

| Ação | Teclas |
|---|---|
| Acelerador | `W`, `↑` |
| Subir marcha | `E` |
| Descer marcha | `Q` |
| Reiniciar simulação / correr de novo | `R` |
| Pausar | `P`, `Esc` |
| Câmera (seguir / os dois carros / largada) | `C` |
| Mostrar ou ocultar o Developer Lab | `T` |
| Silenciar áudio | `M` |

### Remapeamento

Em **Configurações**:

- **Trocar a tecla:** clique na tecla de uma ação e pressione a nova (`Esc` cancela).
- **Teclas alternativas:** `+` adiciona e `−` remove.
- **Validação:**
  - uma tecla não pode servir a duas ações;
  - teclas reservadas pelo navegador (`Tab`, `F5`, `F11`, `F12`, tecla Windows/Command) não são aceitas;
  - acelerar, subir e descer marcha precisam ter pelo menos uma tecla.
- **Restaurar padrão:** volta ao mapeamento original.

O mapeamento é salvo no IndexedDB.

Enquanto o foco está em um campo de texto, como o editor de carro, as teclas não acionam o carro.

## Acelerador progressivo

O teclado é binário, mas o pedal não é: segurar a tecla leva o pedal de 0 a 100 %.

- **Subida:** 90 ms por padrão, ajustável em **Configurações → Condução e câmera → Resposta do acelerador (0→100 %)**, de 20 a 600 ms.
- **Volta a zero:** 70 ms ao soltar.

Depois do pedal ainda há o atuador da borboleta e o enchimento do coletor, que são física, não filtro de entrada.

## Trocas

- **`E` (subir):** corte de torque, abre a embreagem, engata, fecha a embreagem. A rotação cai sozinha, pela inércia do motor.
- **`Q` (descer):** a mesma sequência, com "punta-taco" automático para igualar a rotação.
- **Reduções perigosas:** uma redução que levaria o motor acima de 97 % do limitador é **recusada**, e o HUD mostra "Redução recusada: a rotação passaria do limite seguro". No editor, a proteção pode ser trocada para **aguardar**: a redução fica pendente até a rotação permitir.
- **Durante uma troca:** um novo pedido fica guardado e é reavaliado ao fim da troca atual.
- **Ponto morto e primeira:** do ponto morto, `E` engata a primeira. Parado e engatado, a embreagem abre sozinha para o motor não morrer.

## Freios automáticos

- **Corrida, na linha:** enquanto o carro está no estágio e o pedal está abaixo de 2 %, ele fica seguro pelos freios. Acelerar solta o carro.
- **Corrida, depois da chegada:** o carro corta o acelerador e freia a ≈ 0,55 g, limitado pela aderência e pelo torque de freio.
- **Sandbox:** nos últimos 260 m da pista, o mesmo freio automático entra e o HUD avisa. Fim da pista: frenagem automática (R reinicia).

Em qualquer momento, `R` reinicia a simulação.

## Telas de toque

Em telas de toque aparecem três botões no canto direito: **descer**, **subir** e um **acelerador** grande. O acelerador funciona enquanto o dedo estiver nele.

Em **Configurações → Botões de condução na tela** é possível escolher:

| Opção | Comportamento |
|---|---|
| automático (telas de toque), o padrão | só em telas de toque |
| sempre | os botões sempre aparecem |
| nunca | os botões nunca aparecem |

Os botões aparecem no Sandbox e na Corrida, não no dinamômetro.

## Foco e pausa

- **Perda de foco:** se a janela perde o foco ou a aba fica oculta, todas as teclas são soltas e o pedal volta a zero, mesmo que a tecla continue fisicamente pressionada.
- **Pausa:** congela o relógio da simulação. Como a física deixa de enviar quadros ao áudio, o som some com fade. `P` de novo continua.
- **Passo a passo:** no Sandbox, o Developer Lab também tem um botão para avançar um passo de física (1/120 s) por vez, com a simulação pausada.

## Câmera

`C` alterna entre três modos:

- **seguir:** o carro ocupa cerca de um terço da tela; o zoom abre com a velocidade e a câmera olha à frente. Na corrida, a árvore de largada fica em quadro enquanto o carro está na linha, e um adversário a menos de 16 m é mantido na imagem;
- **os dois carros:** enquadra ambos;
- **largada:** fixa na linha.

O zoom base é ajustável em **Configurações → Zoom da câmera**, de 0,6× a 1,6×.

## Gráficos

Em **Configurações → Gráficos**:

- **Perfil gráfico:** baixo, médio ou alto. Muda a resolução das texturas, o número de partículas, o desfoque das rodas e as camadas opcionais. Não altera a física nem o som.
- **Iluminação:** padrão da pista, dia, fim de tarde ou noite.

## Garagem

O botão **Garagem**, no topo, mostra cada carro em detalhe e permite escolher o carro e a pintura para o modo aberto. `Esc` fecha.
