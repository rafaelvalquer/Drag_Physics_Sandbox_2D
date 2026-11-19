# Auditoria de design do catálogo de peças

Auditoria de 19/11/2026 (leitura do código + `scripts/parts-gain-report.ts` no Chevette e no 320i). Cada item
tem evidência, o estado atual e o motivo de ter ficado para depois, quando é o caso. "Salvo em risco" quer dizer
que a mudança pode tornar inválido um build que um jogador já salvou (regra do projeto: não quebrar saves).

## Resolvidos

| # | Problema | O que mudou |
|---|---|---|
| 1 | `rods-reinforced` (310 N·m) e `pistons-forged` (340 N·m) **baixavam** o limite de torque dos internos no Chevette/Saveiro (limite de fábrica 320–341 N·m) | Limites 400 / 440 / 520 N·m (bielas / pistões / kit forjado). Só relaxa uma validação: nenhum build válido muda. Teste: `tests/unit/career/parts-design.test.ts` |
| 6 | Texto de `compression-high` dizia "não aceita turbo com gasolina", o que só vale acima de 10,5:1 | Texto corrigido com o limite real (10,5:1 gasolina, 13:1 etanol) |

## Entregue em outra frente

| # | Problema | Onde |
|---|---|---|
| 10 | `cam-turbo` perde para `cam-na-race` até em carro turbo (Chevette turbo: 131 contra 138 cv) | Sessão "Rebalancear comando aspirado vs comando turbo" |

## Pendentes (precisam de decisão de balanceamento)

| # | Problema | Por que não foi feito junto |
|---|---|---|
| 2 | O limite de combustível (`fuelBoostLimitBar`) ignora os bônus de `wastegateHoldAddBar` (turbo-medium + bicos + taxa baixa + wastegate race roda ~1,27 bar com bicos de 1,05) | Salvo em risco: o Chevette do usuário (turbo forte, bomba 1,5 bar, 1,5 bar no Dyno) passaria a ser inválido |
| 3 | `boost-street`/`boost-race` repetem o slider grátis do Dyno e podem **baixar** a pressão do kit | Decidir: virar peça que sobe o teto ou ser removida |
| 4–5 | Stage 2 e Stage 3 perdem para `ecu-programmable` (+ `boost-control`), que abre antes | Salvo em risco (v2) e exige decidir o que cada ECU oferece de único |
| 7 | Celta VHC (12,6:1) nunca aceita turbo: `compression-low` tira 1,2 e o limite é 10,5 | Exige peça nova ou exclusão explícita |
| 8 | Sentido de `turboFlowScale` e do spool das turbinas contradiz os textos | Exige reler `Turbocharger.ts` e recalibrar as quatro turbinas |
| 9 | `turbine-medium` é dominada por `turbine-small` pela metade do preço | Mesmo ponto do item 8 |
| 11 | `diff-long` e `differential-short` escolhem quase a mesma relação | Decidir se o longo vira relação fixa |
| 12 | `exhaust-sport` já inclui coletor, tubo e abafador; os slots seguintes quase não somam | Rebalancear o conjunto do escape |
| 13 | ECUs não rendem em aspirado (+0,2 a +0,7 cv) | Decidir o que a ECU libera em aspirado |
| 14–15 | `compression-low` embute um hold de wastegate; `turbo-strong` diz exigir taxa baixa sem exigir | Salvo em risco |
| 16 | `turbo-hybrid` quase não rende no ajuste padrão (+0,7 cv) | Só aparece com mais pressão no slider |
| 17 | ECUs Stage fora de `REV_ECUS` (sem slider de corte) | Decidir quais ECUs liberam o corte |
| 18 | Carros modernos de câmbio manual só têm `clutch-reinforced` | Peça nova |
| 19–20 | Inércia das cerâmicas e degraus de pneus (semi-slick ≈ sport) | Recalibrar |
| 21 | Campos mortos: `FilterPart.intakeGainDelta`, `ExhaustPart.spoolTimeScale` | Remover ou implementar |
| 22 | Corte do comando + ECU empilha além do limite da família (K20: +700 contra 300) | Decidir o teto |
| 23 | `valve-springs` não dão ganho, só abrem corte | Esperado; só com ECU de corte |
| 24 | Internos aspirados cortam a curva sem aviso (Família II, K20) | Avisar na Oficina |
| 25 | `wastegate-race` tem a faixa limitada pela bomba e pelo teto de 1,8 bar | Dependência já mostrada na lista de requisitos |

Desbloqueios: radiador, óleo e ventoinha dependem de `part-cam`; `launch-control` só em `c2-gearbox`; `c2-awd` só
na etapa 9 do Capítulo 2.
