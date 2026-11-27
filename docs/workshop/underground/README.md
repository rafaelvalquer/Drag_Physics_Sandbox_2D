# Underground Workshop 2.0

A Campanha e o Online montam o mesmo controlador em `src/ui/workshop`. O menu
principal contém categorias, a segunda barra contém os slots do veículo e o
carrossel mostra as peças do slot ativo. O palco usa o compositor 2D, o registro
de ilustrações e os canvases existentes. Os detalhes e a comparação técnica
abrem sobre o palco. No celular, os detalhes abrem pela base da tela.

## Organização e prévia

`WorkshopSlotMapping` usa `physicalSlotOf` para agrupar as peças. A localização
é de apresentação. Intercooler e controle de pressão ficam em Turbo. Kits de
conversão e upgrades da turbina de fábrica têm slots de apresentação distintos.
IDs, preços e regras do catálogo vêm dos módulos existentes.

O adaptador da Campanha lê o save local e delega as operações ao `CareerController`.
O adaptador Online lê o veículo individual da garagem autenticada, seus PP e
seus nós. O estoque segue o escopo existente por modelo. A prévia usa
`resolveBuild` e `reconcileTune`, preserva a pintura e oferece a comparação do
conjunto quando há requisitos. A estimativa de pista roda fora da thread da
interface e é cancelada quando a seleção ou o painel muda.

A seleção, o modo de visualização e a posição do carrossel ficam no estado da
tela. Uma atualização do Online usa o snapshot retornado pelo servidor e
mantém a oficina montada. As visitas ao dinamômetro e à árvore restauram a
navegação do veículo.

## Persistência online

| Operação | Efeito |
| --- | --- |
| `unlock` | Confirma e consome PP do veículo, liberando o nó |
| `buyPart` | Compra para o estoque |
| `buyAndInstall` | Debita CR e instala a peça em uma transação |
| `install` | Instala uma peça retirada do estoque |
| `installBundle` | Usa o estoque disponível, compra o restante e valida o projeto completo |
| `restoreStock` | Restaura um slot, um conjunto de slots ou o carro inteiro |

O servidor serializa operações da conta pelo bloqueio do perfil. Confere a
propriedade, a revisão, a atividade em fila ou partida, os desbloqueios e o
resolver. A instalação de conjunto agrega o débito de CR em uma entrada de
ledger e usa o preço oficial. O valor confirmado pela interface limita a
cobrança em caso de mudança de estoque. A restauração devolve as peças ao
estoque e conserva os desbloqueios.

O mesmo `operationId` é reutilizado quando a resposta de rede é incerta. A
interface oferece consulta da operação pendente e recarrega o snapshot em
caso de conflito de revisão antes de uma nova confirmação. O schema existente
de garagem, estoque, ledger e operações suporta esse fluxo.

## Evidências

- [Relatório de desempenho e validação](performance.md)
- [Capturas da Campanha e do Online](captures/)
