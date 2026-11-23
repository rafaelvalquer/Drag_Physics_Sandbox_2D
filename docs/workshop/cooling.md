# Arrefecimento da oficina

Radiador, resfriador de óleo e ventoinha têm três estágios nos 25 carros da campanha. Os novos conjuntos ocupam as categorias já existentes, preservam as peças e os IDs instalados em saves anteriores e acrescentam massa ao veículo.

| Componente | Aumento de capacidade por estágio | Condição em que atua |
|---|---:|---|
| Radiador | 16%, 36%, 60% | Troca térmica do líquido de arrefecimento com o ar |
| Resfriador de óleo | 20%, 48%, 78% | Troca térmica do óleo com o ar |
| Ventoinha | 24%, 54%, 90% | Vazão assistida com o líquido quente, mais relevante em baixa velocidade |

A simulação usa circuitos de líquido e óleo com capacidades térmicas estimadas pela cilindrada. O calor acompanha a potência indicada, e a velocidade do carro aumenta a troca com o ar. O óleo e o líquido também trocam calor entre si. Cada sessão começa com o motor aquecido. A bancada de potência simula ventilação forçada de 55 m/s, equivalente ao fluxo em alta velocidade, para preservar as medições nominais de fábrica. Acima de 112 °C no líquido ou 137 °C no óleo, a proteção reduz gradualmente o torque entregue e o HUD avisa o piloto.

Os coeficientes e as temperaturas são parâmetros da simulação. A auditoria aplica 100 s de carga padronizada a 30 °C, com 20 m/s de ar nos testes de radiador e óleo e com o carro parado no teste da ventoinha. Nas 225 trocas medidas, a queda de temperatura por troca foi de 1,15 a 11,03 °C no radiador, 2,97 a 7,35 °C no óleo e 2,34 a 10,51 °C na ventoinha. O maior acréscimo de tempo observado foi de 0,043 s nos 402,336 m.

As três peças legadas também passaram a atuar no circuito térmico, mantendo seus efeitos anteriores sobre atrito e detonação. O radiador acrescenta 30% de área efetiva, o resfriador melhora a capacidade de troca em 32% e a ventoinha aumenta o fluxo assistido em 25%. Os três acrescentam massa.

Para repetir, execute `npx tsx scripts/parts-stage-report.ts --groups=cooling-radiator,cooling-oil,cooling-fan --fail`.
