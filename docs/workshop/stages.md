# Sequências de preparação

Cada sequência reúne alternativas para a mesma categoria física e especialização. O Stage 2 substitui o Stage 1 no seu slot. A lista de peças instaladas continua guardando os IDs de sempre. O catálogo exibe estágio e especialização ao lado do capítulo e mostra o evento exigido nas opções bloqueadas.

As opções de uma sequência aparecem em ordem crescente, com o preço no card. O comparador mostra a variação do torque médio por faixa de rotação e, quando muda, a constante de enchimento do turbo.

Execute `npx tsx scripts/parts-stage-report.ts` para comparar os estágios em todos os carros. Para reduzir o diagnóstico a um modelo, use `--car=bmw-320i-f30-2014`. A opção `--out=<diretório>` escolhe onde gravar Markdown e JSON e `--fail` reprova séries incompletas ou sem ganho comprovado.

O auditor usa o mesmo conjunto de apoio ao comparar uma série de peças. Para os remaps genéricos legados, a comparação mede os pacotes completos. O Stage 2 acrescenta o downpipe e o intercooler exigidos, e o Stage 3 acrescenta a turbina híbrida. Os internos e a transmissão de apoio ficam fixos. Os mapas por família têm sua própria série e usam a mesma turbina nos três estágios. O JSON registra os IDs das peças em cada comparação.

Nos clássicos convertidos, as três wastegates existentes formam uma série própria. Elas aumentam a faixa de pressão do kit no Dyno Lab. A série de regulagem de pressão tem alvos de 0,65, 0,80 e 1,00 bar. O novo ajuste intermediário preserva as duas regulagens existentes. A comparação usa o mesmo kit, taxa de compressão, embreagem e alimentação em toda a série.

Os comandos turbo dos clássicos têm dois perfis novos de rua e esportivo, além do perfil de competição existente. Os dois novos perfis exigem instalar o kit turbo. A auditoria mede a série sob pressão, com o mesmo conjunto de apoio em todos os estágios.
