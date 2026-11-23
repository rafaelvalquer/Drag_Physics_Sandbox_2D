# Pneus, estrutura e suspensão de largada

Os 25 carros têm três níveis de composto, largura, calibragem, alívio de peso e suspensão de largada. Composto, largura e calibragem ocupam categorias independentes. As peças anteriores preservam seus IDs. Os clássicos também têm um slick calibrado com a mesma regra de aderência a frio dos carros modernos.

O composto muda aderência, temperatura ideal, sensibilidade térmica e inércia. Rodas mais largas melhoram a aderência e acrescentam inércia rotacional. Os níveis de calibragem reduzem a resistência ao rolamento e ajustam a rigidez longitudinal. O ajuste fino de pressão do Dyno Lab continua disponível conforme o equipamento instalado.

A suspensão altera a altura efetiva de transferência de carga e a massa. Carros de tração dianteira conservam carga na frente. Carros de tração traseira transferem mais carga para trás. Nos integrais modernos, a mudança é menor para preservar a participação do eixo dianteiro. O alívio de peso atua na massa e preserva a configuração do motor.

Execute `npx tsx scripts/parts-stage-report.ts --groups=tire-compound,tire-width,tire-pressure,weight-reduction,launch-suspension --fail`. A tabela registra a aderência à temperatura de pista, a resistência ao rolamento, a massa e a mudança de transferência de carga, junto com o tempo de pista.

No Lexus IS 350, o primeiro alívio custou 0,681 s no conjunto de fábrica por causa de uma mudança na sequência de trocas. Com pneus esportivos, todos os níveis de alívio encurtaram a passagem. No C43 original, o primeiro nível de composto ou largura aumentou o tempo em 0,091 s ou 0,096 s, apesar do ganho de aderência. Com o upgrade do automático instalado, a perda entre estágios ficou dentro da margem da auditoria. As comparações destas séries usam o mesmo conjunto de apoio do original ao Stage 3.

Após corrigir o kickdown, a suspensão do IS 350 passou a usar incrementos menores de transferência efetiva. Os níveis são +10, +16 e +22 mm, com a redução de massa preservada. As três trocas de estágio foram aprovadas na nova passagem de referência.
