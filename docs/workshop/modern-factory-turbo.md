# Turbinas e intercoolers dos motores turbo de fábrica

Os 13 carros modernos com turbo de fábrica têm três estágios de turbina e três de intercooler, com encaixe por família. Nos V6 biturbo, a preparação substitui o par de turbinas e preserva a operação de um rotor por bancada. Os perfis são estimativas para a simulação.

O primeiro estágio da turbina revisa rotor e carcaça e funciona com o mapa original. O segundo usa um conjunto híbrido e exige ECU programável ou mapa Stage 3. O conjunto de competição exige também internos forjados, intercooler com remoção de pelo menos 80% do aquecimento do compressor e alimentação de maior vazão. A capacidade da transmissão continua verificada em todos os estágios. Os remaps aceitam peças que atingem os mesmos requisitos de vazão e arrefecimento das peças legadas.

O modelo recalcula o limite de vazão, a contrapressão no fluxo de referência e a temperatura da carga. O turbo em corrida usa o novo tempo de resposta e a necessidade de vazão de escape para encher. A pressão alvo segue a ECU e a wastegate. A temperatura relatada é estimada à pressão alvo, sob as mesmas condições de referência. Ela complementa o resultado de pista e o torque medido nas três faixas de rotação.

Para reproduzir as comparações execute `npx tsx scripts/parts-stage-report.ts --groups=modern-factory-turbo,modern-intercooler --fail`. Cada série de turbinas usa o mesmo kit de apoio e o mesmo mapa. Na série de intercoolers, a referência é a configuração original. Uma turbina de maior fluxo também pode comprovar avanço com pelo menos 0,5 cv de ganho e 0,1 kPa a menos de contrapressão, com acréscimo de até 0,08 s na passagem de referência. No C43, o Stage 2 acrescentou aproximadamente 2,1 cv, retirou 2,0 kPa de contrapressão e acrescentou 0,075 s nos 402,336 m. A varredura do tempo de resposta do rotor e da redução de contrapressão manteve a diferença de largada.

## Wastegate e controle eletrônico

A wastegate e o solenoide têm três opções independentes por família. A wastegate altera o teto mecânico acima do alvo original, de 0,35 bar de fábrica para 0,48, 0,64 ou 0,80 bar. No Dyno Lab, a faixa disponível é a interseção desse teto com a faixa da ECU programável. O resolver ainda pode recusar um ajuste por detonação, falta de combustível ou capacidade da transmissão.

O solenoide altera o tempo de resposta do turbo. O mapa define o alvo de pressão e a wastegate define o teto. Os kits combinados legados mantêm o comportamento existente. Se um carro já tem um kit com atuador, vale o maior limite mecânico compatível com o mapa, sem somar as capacidades dos dois atuadores.

O relatório compara a pressão que o atuador consegue manter e a constante de tempo do turbo, além dos indicadores de desempenho. No Alfa 690T, o solenoide reduz o tempo de resposta em 4%, 9% e 15% para manter a sequência de troca durante a largada dentro da variação aceita na auditoria. Execute `npx tsx scripts/parts-stage-report.ts --groups=modern-wastegate,modern-boost-control --fail`.
