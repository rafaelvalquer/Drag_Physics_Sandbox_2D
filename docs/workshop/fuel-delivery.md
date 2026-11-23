# Capacidade de alimentação

Cada família moderna tem três conjuntos de bomba e injetores. As capacidades são estimadas a partir da vazão de ar original calculada pelo motor e da mistura-alvo em plena carga. A referência de fábrica acrescenta 12% de margem à demanda calculada. A mistura é estimada separadamente para gasolina e etanol, com enriquecimento nos turbos. A capacidade e a mistura são parâmetros do simulador e não dados certificados dos injetores dos fabricantes.

Os estágios aumentam a vazão contínua em 15%, 32% e 55%. Com capacidade suficiente, a curva de torque fica igual, pois o motor já recebe o combustível que demanda. Se um motor preparado exceder a vazão prevista, o resolver rejeita a combinação equipada com o conjunto insuficiente. Em transientes, o modelo reduz o trabalho indicado de acordo com a carga de ar que pode sustentar a mistura prevista. As rotinas de torque estacionário e dinâmico usam o mesmo cálculo.

O jogo conserva a configuração dos builds que não usam os novos conjuntos. A oficina apresenta a vazão em g/s e o relatório JSON mede a diferença de capacidade. Esse ganho de suporte é independente do ganho de potência. Para testar as sequências:

```sh
npx tsx scripts/parts-stage-report.ts --groups=modern-fuel --fail
```

A auditoria mediu 54 comparações em 18 séries e aprovou todas. A verificação de bancada incluiu injeção insuficiente em motor aspirado e turbo, torque medido em dinamômetro e a rejeição de uma combinação de hardware cuja demanda excedia a capacidade instalada.
