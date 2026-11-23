# Mapas de ECU da campanha

Os 18 carros modernos têm três remaps por família. Nos aspirados, os mapas ajustam a mistura em plena carga, a eficiência da ignição, o limite de torque e o corte de giro. Nos turbos de fábrica, a ECU também comanda a pressão, dentro da capacidade da wastegate e do compressor. O resolver limita o corte pelo trem de válvulas e o torque pelos internos instalados.

A mistura mais rica aumenta a vazão de combustível que o motor precisa sustentar. O Stage 1 foi conferido com o restante do carro original nos 18 modelos. Os mapas turbo Stage 2 e 3 exigem hardware de alimentação compatível. O Stage 3 também exige intercooler e internos reforçados. O resolver confere a vazão da montagem em plena carga. O remap Stage 2 da família aceita a turbina híbrida correspondente. Os remaps aspirados da nova série precisam ser removidos antes de instalar uma conversão turbo.

O Civic Si mantém os perfis originais do i-VTEC. O modelo atual incorpora a transição na curva de torque e usa o ponto de atuação para o áudio procedural. As novas ECUs preservam esse ponto.

Os mapas anteriores e seus IDs permanecem disponíveis. Nos clássicos, o remap leve, a ECU street e a ECU de competição formam uma sequência com menor duração de queima e maior margem contra atraso de ignição sob pressão.

Os parâmetros dos mapas são calibrações da simulação. Execute `npx tsx scripts/parts-stage-report.ts --groups=modern-na-ecu-map,modern-turbo-ecu,classic-ecu --fail` para comparar a mesma montagem de apoio antes e depois de cada troca. O relatório mostra pressão, potência, torque, tempo de passagem, alvo ar/combustível, corte de giro e limite de torque do mapa.
