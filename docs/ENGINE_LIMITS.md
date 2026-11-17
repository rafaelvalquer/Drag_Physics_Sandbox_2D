# Limites de giro e motor quebrado

Código: `src/game/career/tuning/EngineReliability.ts` (limites), `src/physics/engine/EngineOverrevFailure.ts`
(modelo de falha), `src/game/career/tuning/TuningCapabilities.ts` (o que cada peça libera).

## Três giros por build

| Giro | Definição |
|---|---|
| corte de fábrica | `engine.revLimitRpm` do hardware (peças, sem ajuste) |
| recomendado (`recommendedSafeRpm`) | corte de fábrica + 200 rpm (folga para o pico do limitador, medido ≤ 154 rpm) + ganhos de hardware |
| limite mecânico (`maxSafeRpm`) | `engine.maxSafeRpm` + ganhos de hardware (no mínimo recomendado + 100) — máximo do corte programável |

Ganhos de hardware: molas de válvula +400 rpm; bielas forjadas +150 rpm (resistência ×1,25); pistões forjados
+200 rpm (×1,3); kit forjado +400 rpm (×1,6); pistões forjados modernos +300 rpm (×1,5).

Faixas do painel: Seguro (corte até o recomendado), Esportivo (até 35 % do caminho ao limite), Agressivo (até 75 %),
Crítico (acima). Turbo mais de 0,15 bar acima do padrão sobe uma faixa.

## Modelo de falha

`x = (rpm − recomendado) / (limite − recomendado)`; desgaste por segundo
`x² · (0,3 + 0,7·carga + 0,5·boost) · (1 + 0,4·EGT) / resistência`; abaixo do recomendado recupera 4 %/s. Quebra em
100 %. Determinístico, sem alocação por passo.

## Resistência por família (todas **estimativas** para jogabilidade)

| Família | Resistência no limite (s) | Base da estimativa |
|---|---|---|
| VW AP 1.8 | 3,5 | curso longo (86,4 mm), 18,7 m/s no corte |
| Fiat Fiasa 1.0 | 6 | curso curto (54,8 mm), 12,2 m/s |
| GM Chevette 1.6 | 4 | 15,9 m/s, comando com correia |
| GM Família I / II | 4,5 | 8V, 14–18 m/s |
| Honda K20 | 7 | virabrequim forjado de fábrica |
| PSA Prince THP | 3,5 | corrente e pistões sensíveis a giro com pressão |
| VW EA113 1.8T | 5 | bielas forjadas de fábrica |
| Mercedes M274 / BMW N20 / VW EA888 | 4,5 | curso longo (90–93 mm) |
| Mitsubishi 4B11T | 6 | internos de competição (Evo) |
| BMW N55 | 5,5 | seis em linha balanceado |
| genérico (Sandbox) | 4,5 | média |

## Calibração (`npx tsx scripts/overrev-calibration.ts`)

Casos: A fábrica (corrida + 30 s no limitador), B corte seguro, C corte intermediário, D corte no limite (corrida),
E corte no limite segurado no limitador em neutro, F como E com turbo máximo, G recuperação, H como E com molas/forjados.

| Carro | corte → recomendado → limite | A–D | E (quebra) | F | G | H |
|---|---|---|---|---|---|---|
| Gol GTS (AP) | 6.500 → 6.700 → 6.800 | não quebra | 14,6 s | — | 51 % → 11 % | não quebra |
| Uno Mille (Fiasa) | 6.700 → 6.900 → 7.000 | não quebra | 19,6 s | — | 48 % → 8 % | não quebra |
| Chevette | 6.300 → 6.500 → 6.600 | não quebra | 16,1 s | — | 48 % → 8 % | não quebra |
| Civic Si (K20) | 8.600 → 8.800 → 9.000 | não quebra | 28,1 s | — | 49 % → 9 % | não quebra |
| Golf GTI (EA113) | 7.000 → 7.200 → 7.400 | não quebra | 5,8 s | 6,0 s a 1,15 bar | 41 % → 3 % | não quebra |
| Evo X (4B11T) | 7.400 → 7.600 → 7.800 | não quebra | 5,0 s | 4,8 s a 1,60 bar | 36 % → 0 % | não quebra |
| 335i (N55) | 7.200 → 7.400 → 7.600 | não quebra | 7,6 s | 7,8 s a 1,20 bar | 45 % → 5 % | não quebra |

Leitura: o carro de fábrica nunca quebra; em corrida a IA troca antes do corte, então nem o corte máximo quebra numa
passada limpa. O que quebra é segurar o motor no limitador (neutro na largada, marcha errada). Nos aspirados o
pico do limitador fica pouco acima do recomendado, por isso o tempo até quebrar (E) é bem maior que a resistência
nominal. Em F o turbo mais alto quase não muda o tempo: no limitador em neutro a carga é baixa — limitação conhecida.
