# Como reproduzir o baseline da oficina

Execute `npx tsx scripts/parts-coverage-report.ts` para gerar a matriz Markdown e os resultados JSON dos 25 carros, com configurações de fábrica e builds dos rivais. O script aceita um diretório de saída como primeiro argumento. O relatório de ganho individual é `npx tsx scripts/parts-gain-report.ts [car-id] [--fail]`.

O baseline preservado em `parts-coverage-baseline.md` e `parts-coverage-baseline.json` vem do commit `696dbfa`. O relatório registrou 993 ganhos comprovados, 26 combinações medidas sem ganho, 26 bloqueadas por dependência e quatro builds inválidos. Os 25 carros originais completaram a distância de referência, e os 27 rivais foram medidos. Para reproduzir a versão histórica, execute o script daquele commit em um worktree separado.

A referência é a pista de testes com piloto avançado, usando a distância oficial da campanha de 402,336 m. Os tempos de arrancada partem do primeiro movimento. O baseline usa resolver 1 para clássicos de fábrica e resolver 2 para os modernos. A versão persistida continua sendo respeitada pelos builds dos jogadores, com a mesma regra anterior para carros modernos.

Cada peça é avaliada contra um build com o mesmo conjunto de apoio. O relatório distingue incompatibilidade física, dependência sem contexto aceito, build inválido, falha de simulação, ausência de efeito, efeito sem ganho pelos critérios atuais e ganho medido. As dependências da implementação anterior ainda chegam como mensagens do resolver. Quando o auditor reconhece nelas um requisito de hardware, registra essa interpretação e mantém as mensagens originais no JSON.

As contagens por categoria refletem opções compatíveis e opções com ganho. A quantidade de opções pode incluir especializações e ainda não comprova uma sequência Stage 1, 2 e 3. O baseline registra a situação anterior à expansão para que os resultados finais possam ser comparados com ela.
