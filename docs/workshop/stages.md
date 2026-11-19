# Sequências de preparação

Cada sequência reúne alternativas para a mesma categoria física e especialização. O Stage 2 substitui o Stage 1 no seu slot. A lista de peças instaladas continua guardando os IDs de sempre. O catálogo exibe estágio e especialização ao lado do capítulo e mostra o evento exigido nas opções bloqueadas.

Execute `npx tsx scripts/parts-stage-report.ts` para comparar os estágios em todos os carros. Para reduzir o diagnóstico a um modelo, use `--car=bmw-320i-f30-2014`. A opção `--out=<diretório>` escolhe onde gravar Markdown e JSON e `--fail` reprova séries incompletas ou sem ganho comprovado.

O auditor exige que original e todos os estágios da série sejam válidos com o mesmo conjunto de apoio. Assim, compara só a peça que mudou. Um conjunto sem contexto comum permanece marcado como inválido no relatório. Isso revela, por exemplo, a dependência circular legada da ECU Stage 3 e da turbina híbrida quando se tenta medir a sequência completa de remaps sobre a mesma turbina.

Nos clássicos convertidos, as três wastegates existentes formam uma série própria. Elas aumentam a faixa de pressão do kit no Dyno Lab. A série de regulagem de pressão tem alvos de 0,65, 0,80 e 1,00 bar. O novo ajuste intermediário preserva as duas regulagens existentes. A comparação usa o mesmo kit, taxa de compressão, embreagem e alimentação em toda a série.
