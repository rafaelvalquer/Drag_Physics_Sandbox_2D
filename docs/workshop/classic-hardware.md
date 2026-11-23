# Escape, alimentação, ignição e molas nos clássicos

Os sete clássicos têm três estágios independentes de coletor, tubulação e abafador, além de três opções de escape completo. A linha completa oferece 7,0, 5,5 e 4,1 kPa de contrapressão na vazão de referência. Cada estágio altera geometria ou absorção do escape, parâmetros que o áudio procedural recebe da configuração do carro.

Coletor, tubulação e abafador avulsos têm reduções independentes. Com um escape completo instalado, a física aplica a maior redução entre a linha completa e o conjunto de peças avulsas. Uma redução que vem da turbina continua sendo aplicada separadamente. A geometria acústica também evita multiplicar o ganho de diâmetro ou de absorção sobre a mesma seção.

| Sistema | Stage 1 | Stage 2 | Stage 3 |
|---|---|---|---|
| Alimentação | Regulador estabilizado, até 1,00 bar | Bicos maiores, até 1,05 bar | Bomba reforçada, até 1,50 bar |
| Ignição | Velas e bobina melhoradas | Ignição esportiva | Ignição de competição |
| Trem de válvulas | Reserva de 200 rpm | Reserva de 400 rpm | Reserva de 600 rpm |

Os limites de alimentação são tetos do sistema. O kit turbo, a wastegate e a resistência da montagem também limitam a pressão que se pode usar. As molas ampliam a rotação mecânica segura e preservam o corte definido pela ignição. Os IDs das peças anteriores continuam válidos.

Para repetir a auditoria execute `npx tsx scripts/parts-stage-report.ts --groups=classic-exhaust-header,classic-exhaust-pipe,classic-exhaust-muffler,classic-exhaust-system,classic-fuel,classic-ignition,classic-valve-springs --fail`.
