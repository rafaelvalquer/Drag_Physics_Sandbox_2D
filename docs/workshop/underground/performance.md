# Desempenho da Underground Workshop 2.0

## Comparação da seleção

O teste V43 abre a oficina do Gol GTS no Edge com um build de produção
servido localmente. Ele mede com `performance.now()` o processamento síncrono de
três seleções consecutivas na família Escape. O tempo inclui a atualização
imediata da interface e a resolução inicial da prévia.

| Seleção | Oficina anterior, `7965843` | Oficina compartilhada |
| --- | ---: | ---: |
| Escape dimensionado | 40,1 ms | 8,9 ms |
| Escape completo de alta vazão | 9,2 ms | 9,1 ms |
| Escape completo de competição | 7,2 ms | 7,1 ms |

A maior amostra caiu de 40,1 ms para 9,1 ms. As três amostras ficaram abaixo
dos 100 ms definidos no plano. A transição de Escape para Turbo registrou
16,1 ms por quadro, em média, durante 25 callbacks de `requestAnimationFrame`.
O teste também verificou que passar o cursor pelo carrossel e deixar a tela
ociosa preserva o contador de pinturas do palco. A cadência mede o navegador
local. A latência das operações Online depende da conexão e do servidor.

## Entrada e saída da oficina

| Fechamento | Heap JavaScript após coleta |
| --- | ---: |
| Primeiro | 15,31 MiB |
| Segundo | 15,33 MiB |
| Terceiro | 15,53 MiB |

O teste coletou o heap via protocolo do navegador após cada saída. O canvas
foi removido nas três saídas e recriado uma vez a cada retorno. Uma segunda
execução registrou 15,32, 15,48 e 15,38 MiB. A amostragem cobre o heap
JavaScript de três ciclos por execução.

## Cobertura

- Os testes do catálogo cobrem os 25 modelos com a versão real do resolver.
- A Campanha foi exercitada com saves locais, compra, conjunto, requisitos,
  comparação, teclado, toque e retorno do dinamômetro.
- O Online foi exercitado com a API real do projeto, banco descartável e
  provedor OAuth local. A suíte cobre desbloqueio por PP, compra para estoque,
  compra e instalação, conjunto, restauração e corrida 1v1 em duas sessões.
- O teste de persistência verifica autorização de garagem, revisão,
  idempotência, fila de corrida e reversão de CR e estoque quando a
  transação falha.
- A regressão do áudio inclui os testes de Turbo Acoustics com o rotor híbrido.

As [capturas](captures/) registram os três carros de referência, cinco
formatos de janela e as operações da oficina Online.
