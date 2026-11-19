# Internos e compressão dos carros modernos

Os 18 carros dos capítulos Liga e Elite têm três conjuntos de pistões, bielas e anéis. Cada nível combina menor inércia e atrito com maior capacidade de torque e maior tolerância à sobre-rotação. A instalação mantém a taxa de compressão e o corte de fábrica. O Dyno Lab e a simulação de falha usam os novos limites de rotação e a reserva de tempo. Os valores são estimativas do modelo, ancoradas na rotação e nos limites mecânicos de cada família.

Nos cinco aspirados, o retrabalho das câmaras ocupa uma categoria própria. O resolver combina o volume de câmara escolhido com a geometria dos pistões e calcula a mudança de rendimento térmico pelo ciclo Otto. A oficina recusa a montagem se a taxa combinada exceder o limite do combustível. A preparação de alta compressão continua disponível ao lado dos pistões aspirados de ID legado.

Nos turbos de fábrica, o mapa Stage 3 exige um conjunto classificado para pelo menos 145% da capacidade original. O conjunto forjado legado e o novo estágio 3 cumprem o requisito. Os estágios inferiores preservam o acesso ao mapa Stage 2 dentro do limite de torque do conjunto instalado.

No Lexus 2GR-FSE, a simulação mostrou uma transição na sequência de trocas durante a largada. Reduções maiores de inércia ou aumentos maiores de compressão custaram aproximadamente 0,7 s. A calibração usa mudanças menores de massa alternada, atrito e volume de câmara, com ganhos de capacidade mecânica ou potência que podem ser conferidos junto ao tempo de pista.

Para repetir a auditoria de trocas adjacentes, execute `npx tsx scripts/parts-stage-report.ts --groups=modern-rotating-assembly,modern-na-compression --fail`. O relatório inclui a reserva de rotação segura, a inércia e os tempos dos dois builds de cada comparação.

As molas e pratos de válvulas têm três estágios por família. Cada conjunto aumenta a rotação mecânica segura, mantendo o corte previamente calibrado. Com uma ECU que permite alterar o corte, o ganho abre uma faixa maior de ajuste no Dyno Lab. A série antiga de molas mantém o mesmo ID e o mesmo efeito.

Os três estágios de ignição reduzem a duração efetiva da combustão em graus de virabrequim, usada também pelo áudio procedural. Nos turbos de fábrica, velas e bobinas calibradas diminuem a estimativa de perda por atraso de centelha sob carga. A pressão segue definida pela ECU e pela wastegate. A auditoria mede a duração da queima e a perda por detonação junto com potência, torque e tempo de pista. Para replicar a comparação use `npx tsx scripts/parts-stage-report.ts --groups=modern-ignition,modern-valve-springs --fail`.
