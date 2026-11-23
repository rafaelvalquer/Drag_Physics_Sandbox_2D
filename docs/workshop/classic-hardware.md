# Escape, alimentação, ignição e molas nos clássicos

Os sete clássicos têm três estágios independentes de coletor, tubulação e abafador, além de três opções de escape completo. A linha completa oferece 7,0, 5,5 e 4,1 kPa de contrapressão na vazão de referência. Cada estágio altera geometria ou absorção do escape, parâmetros que o áudio procedural recebe da configuração do carro.

Coletor, tubulação e abafador avulsos têm reduções independentes. Com um escape completo instalado, a física aplica a maior redução entre a linha completa e o conjunto de peças avulsas. Uma redução que vem da turbina continua sendo aplicada separadamente. A geometria acústica também evita multiplicar o ganho de diâmetro ou de absorção sobre a mesma seção.

| Sistema | Stage 1 | Stage 2 | Stage 3 |
|---|---|---|---|
| Alimentação | Regulador estabilizado, até 1,00 bar | Bicos maiores, até 1,05 bar | Bomba reforçada, até 1,50 bar |
| Ignição | Velas e bobina melhoradas | Ignição esportiva | Ignição de competição |
| Trem de válvulas | Reserva de 200 rpm | Reserva de 400 rpm | Reserva de 600 rpm |

Os limites de alimentação são tetos do sistema. O kit turbo, a wastegate e a resistência da montagem também limitam a pressão que se pode usar. As molas ampliam a rotação mecânica segura e preservam o corte definido pela ignição. Os IDs das peças anteriores continuam válidos.

## Internos

Os três conjuntos mantêm os IDs existentes e passam a oferecer limites estimados de 400, 440 e 520 N·m. As bielas reforçadas agora ampliam a capacidade em todos os sete clássicos. O segundo estágio inclui bielas e pistões forjados, e o terceiro acrescenta o virabrequim. Os três reduzem o atrito em graus diferentes.

A oficina mostra a capacidade antes e depois. A auditoria confirmou aumento de capacidade nas 21 comparações de internos. Uma montagem de referência do Gol a 1,50 bar excedeu 400 N·m e o resolver só a aceitou a partir do segundo estágio.

Para repetir a auditoria execute `npx tsx scripts/parts-stage-report.ts --groups=classic-exhaust-header,classic-exhaust-pipe,classic-exhaust-muffler,classic-exhaust-system,classic-fuel,classic-ignition,classic-valve-springs,classic-rotating-assembly --fail`.
