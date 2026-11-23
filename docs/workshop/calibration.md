# Calibração da oficina

Os dados de fábrica vêm das fichas e referências registradas com os carros e motores em `src/data`. As dimensões de peças preparadas e os limites de montagem são parâmetros da simulação. Quando uma referência de fábrica não fornece um destes parâmetros, os documentos por sistema registram a estimativa e a condição que ela representa.

| Sistema | Parâmetros calibrados | Verificação |
|---|---|---|
| Motor aspirado | Fases e levante das válvulas, seções de dutos, taxa, inércia e atrito | Curva de torque em três faixas comuns de rotação, potência, rotação segura e passagem de referência |
| Motor turbo | Vazão e tempo de enchimento do turbo, pressão da wastegate, temperatura da carga, taxa e margem de detonação | Curva com o mesmo apoio mecânico, pressão e temperatura em condições de referência, teste de arrancada |
| Alimentação e eletrônica | Vazão de combustível, mistura, duração da combustão, atraso de centelha e limites do mapa | Mesma montagem de apoio por série, exceto os mapas legados que exigem pacotes de hardware específicos |
| Transmissão, pneus e carroceria | Capacidade de torque, escalonamento, perdas, aderência, distribuição de carga e massa | Torque transmissível, tempo de troca, aderência na temperatura de pista, 0–100 e quarto de milha |
| Arrefecimento | Área de troca, vazão da ventoinha e massa | Carga térmica sustentada com entrada de calor, temperatura ambiente e velocidade iguais nos dois builds |

Uma peça de suporte pode melhorar a faixa de operação mesmo quando o mapa ou o limite de outro componente mantém a potência. O relatório distingue esses ganhos e mostra o tempo de pista ao lado deles. Um motor de baixa compressão pode aceitar mais pressão e perder eficiência com o mapa original. Uma turbina de carcaça maior pode respirar melhor em alta e demorar mais a encher. Uma embreagem de maior capacidade transmite um torque maior quando o motor o entrega.

A compatibilidade considera família, aspiração, câmbio e tração. A oficina valida novamente a montagem ao instalar a peça, inclusive pressão, alimentação, capacidade dos internos e do câmbio e rotação segura. Peças alternativas ocupam o mesmo slot. Nos V6 biturbo, a seleção considera as duas bancadas. Nos câmbios com conversor, o estol substitui o controle de largada usado nas embreagens. A matriz de cobertura registra as exclusões por carro, incluindo a conversão turbo opcional do Lexus IS 350.

## Calibrações por sistema

- [Motor e válvulas dos clássicos](classic-hardware.md)
- [Admissão, escape e comando dos modernos](modern-intake-exhaust.md) e [fase e cabeçote](factory-breathing.md)
- [Turbo dos clássicos](classic-turbo.md), [turbo de fábrica](modern-factory-turbo.md) e [conversões](modern-turbo-conversions.md)
- [Internos dos modernos](modern-internals.md), [alimentação](fuel-delivery.md) e [mapas de ECU](modern-ecu.md)
- [Transmissão dos clássicos](classic-driveline.md), [transmissão e AWD dos modernos](modern-driveline.md) e [pneus e suspensão](chassis.md)
- [Arrefecimento](cooling.md) e [procedimento de reprodução dos relatórios](baseline-method.md)
