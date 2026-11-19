# Conversão turbo dos aspirados modernos

Astra 2.0, Civic Si, Nissan 350Z e Nissan 370Z têm três kits específicos de turbina, coletor, intercooler, controle de pressão e linhas de óleo. A oficina mantém as peças de preparação aspirada disponíveis. Os kits clássicos continuam restritos às famílias originais.

| Motor | Taxa com a câmara de conversão | Stage 1 | Stage 2 | Stage 3 |
|---|---:|---:|---:|---:|
| GM Família II 8V | 10,1:1 | 0,35 bar | 0,50 bar | 0,65 bar |
| Honda K20Z3 | 10,0:1 | 0,32 bar | 0,45 bar | 0,58 bar |
| Nissan VQ35DE | 10,0:1 | 0,30 bar | 0,44 bar | 0,57 bar |
| Nissan VQ37VHR | 9,9:1 | 0,29 bar | 0,42 bar | 0,55 bar |

A câmara rebaixa a taxa antes da conversão. Os três estágios exigem alimentação, ignição e internos de capacidade correspondente ou maior, além de um radiador de óleo. A oficina confere a taxa instalada, a demanda de combustível em plena carga, a detonação e os limites de torque do motor e da transmissão. Os sistemas de combustível dessas quatro famílias foram calibrados com capacidades de 132%, 144% e 158% sobre a estimativa original para sustentar a mistura mais rica com turbo. O primeiro estágio tem suporte disponível no mesmo ponto da campanha em que o kit é liberado.

Cada kit combina pressão, volume dos dutos, tempo de resposta do rotor, massa e eficiência do intercooler próprios. O modelo calcula a curva sob pressão pela vazão e temperatura da carga e pelo atraso de centelha. O Dyno Lab pode reduzir a pressão dentro da faixa do conjunto, e a turbina e a válvula de alívio passam a gerar áudio em corrida. O Civic mantém o i-VTEC e os Nissan mantêm seus perfis originais de válvulas.

As medidas são calibrações da simulação. Para comparar a troca de kit com o mesmo conjunto de apoio, execute `npx tsx scripts/parts-stage-report.ts --groups=modern-na-turbo-conversion --fail`. O estágio zero é o build aspirado com o mesmo apoio. Para a câmara de conversão, o relatório por peça compara a pressão liberada e o desempenho do build que ela torna possível.

| Carro | Pico de potência do aspirado ao Stage 3 | Tempo nos 402,336 m do aspirado ao Stage 3 |
|---|---:|---:|
| Astra 2.0 | 136,8 → 186,1 → 207,8 → 230,9 cv | 16,792 → 15,709 → 15,341 → 15,009 s |
| Civic Si | 190,8 → 243,0 → 262,4 → 281,9 cv | 15,695 → 14,990 → 14,773 → 14,600 s |
| 350Z | 307,9 → 381,0 → 412,2 → 441,8 cv | 14,017 → 13,476 → 13,308 → 13,109 s |
| 370Z | 332,3 → 414,1 → 448,0 → 482,1 cv | 13,678 → 13,123 → 12,996 → 12,791 s |

O Lexus IS 350 fica com a linha aspirada nesta etapa. Uma conversão do 2GR-FSE requer calibração da alimentação mista direta e indireta e validação do conversor automático sob carga.
