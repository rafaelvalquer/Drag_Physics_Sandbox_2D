# Limites de giro e motor quebrado (Blown Engine 2.0)

Código: `src/game/career/tuning/EngineReliability.ts` (limites), `src/physics/engine/EngineOverrevFailure.ts`
(modelo de falha), `src/game/career/tuning/TuningCapabilities.ts` (o que cada peça libera),
`src/ui/hud/strainDisplay.ts` (barra do HUD).

## Três giros por build

| Giro | Definição |
|---|---|
| corte original | `engine.revLimitRpm` do hardware (peças, sem ajuste do Dyno Lab) |
| recomendado (`recommendedSafeRpm`) | corte original + 50 rpm + ganhos de hardware |
| limite mecânico (`maxSafeRpm`) | `engine.maxSafeRpm` + ganhos de hardware: o maior corte que a ECU aceita |

Ganhos de hardware: molas de válvula +400 rpm; bielas forjadas +150 rpm (resistência ×1,25); pistões forjados
+200 rpm (×1,3); kit forjado +400 rpm (×1,6); pistões forjados modernos +300 rpm (×1,5). Subir o corte não aumenta
a resistência; só o hardware aumenta.

## Modelo de falha

- **Giro filtrado** (filtro de 1ª ordem, 250 ms): no limitador o giro oscila em dente de serra; as peças sentem o
  giro sustentado. Medido em sete motores, o giro filtrado no limitador fica 12–130 rpm **abaixo** do corte, por
  isso a margem de 50 rpm deixa o corte original sempre seguro, e uma queda do corte não conta como descanso.
- `x = (giroFiltrado − recomendado) / (limite − 100 − recomendado)`: x = 1 é o motor segurado num corte no
  limite mecânico; acima disso (marcha errada, sobre-rotação) até x = 2,5.
- Risco por segundo: `x^1,5 · (0,3 + 0,7·carga + 0,5·boost) · (1 + 0,4·EGT) / resistência`.
- **Recuperação**: só depois de 0,5 s seguidos abaixo do recomendado, a 5 %/s. Durante esse meio segundo o risco
  fica parado.
- Quebra em 100 %. Determinístico, sem alocação por passo. O reinício (`VehicleSimulation.reset`) zera o risco.
- Faixas do painel do Dyno (pela posição do corte entre recomendado e limite): Seguro, Esportivo (até 35 %),
  Agressivo (até 75 %), Crítico. Turbo mais de 0,15 bar acima do padrão sobe uma faixa.

## Resistência por família (s segurando um corte no limite mecânico)

Todos os valores são **decisões de balanceamento** calibradas com o script abaixo, ordenadas por estimativas
técnicas (velocidade média do pistão no corte de fábrica, curso e fama do projeto). Nenhum fabricante publica um
giro de falha.

| Família | Antes | Agora | Base técnica da ordem |
|---|---:|---:|---|
| VW AP 1.8 | 3,5 | 2,2 | curso longo (86,4 mm), 18,7 m/s no corte |
| Fiat Fiasa 1.0 | 6 | 2,8 | curso curto (54,8 mm), 12,2 m/s |
| GM Chevette 1.6 | 4 | 2,4 | 15,9 m/s, comando com correia |
| GM Família I | 4,5 | 2,8 | 8V, 14–15 m/s |
| GM Família II | 4,5 | 2,4 | 8V, 17–18 m/s |
| Honda K20 | 7 | 1,8 | virabrequim forjado; o valor é menor porque o limitador do K20 cai mais (166 rpm), então o giro filtrado alcança menos do limite |
| PSA Prince THP | 3,5 | 2,5 | corrente e pistões sensíveis a giro com pressão |
| VW EA113 1.8T | 5 | 3,1 | bielas forjadas de fábrica |
| Mercedes M274 / BMW N20 / VW EA888 | 4,5 | 2,9 | curso longo (90–93 mm) |
| Mitsubishi 4B11T | 6 | 3,4 | internos de competição (Evo) |
| BMW N55 | 5,5 | 3,3 | seis em linha balanceado |
| genérico (Sandbox) | 4,5 | 3 | média |

## Calibração (`npx tsx scripts/overrev-calibration.ts`)

Cenários (segurado = neutro, pé no fundo, no limitador real): 1 corte original 30 s; 2 Esportivo; 3 Agressivo; 4
Crítico (corte no limite) com contagem de quedas do risco durante o ciclo do limitador; 5 402 m com trocas certas
(IA); 6 402 m com cada troca 1,5 s atrasada no limitador; 7 recuperação; 8 reforçado (molas + forjados) no corte
crítico de 4; 9 quebrar, reiniciar e repetir. "Extremo" = sobre-rotação mecânica a x = 2,5 (pelo modelo).

### Antes (Blown Engine 1, corte no limite segurado em neutro)

Gol 14,6 s · Uno 19,6 s · Chevette 16,1 s · Civic 28,1 s · Golf GTI 5,8 s · Evo X 5,0 s · 335i 7,6 s. Em 402 m
nada quebrava, nem com trocas atrasadas.

### Depois

| Carro | Corte orig. → recom. → limite | 1 | 2 Esportivo | 3 Agressivo | 4 Crítico (rpm médio/máx) | quedas | 5 trocas certas | 6 trocas atrasadas | 8 | 9 | extremo |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Gol GTS | 6.500 → 6.550 → 6.800 | ok | 14,6 s | 5,6 s | 3,8 s (6.690/6.846) | 0 | ET 16,77 s | quebra 10,3 s | ok | ok | 0,56 s |
| Uno Mille | 6.700 → 6.750 → 7.000 | ok | 18,0 s | 6,2 s | 4,0 s (6.908/7.046) | 0 | ET 19,26 s | chega (82 %) | ok | ok | 0,71 s |
| Chevette | 6.300 → 6.350 → 6.600 | ok | 18,3 s | 5,8 s | 3,8 s (6.495/6.644) | 0 | ET 18,70 s | chega (99 %) | ok | ok | 0,61 s |
| Celta | 6.800 → 6.850 → 7.100 | ok | 8,8 s | 5,2 s | 3,8 s (7.017/7.127) | 0 | ET 18,65 s | quebra 15,8 s | ok | ok | 0,71 s |
| Corsa GL | 6.200 → 6.250 → 6.500 | ok | 8,7 s | 5,0 s | 3,6 s (6.419/6.535) | 0 | ET 19,10 s | chega (84 %) | ok | ok | 0,71 s |
| Kadett | 6.500 → 6.550 → 6.800 | ok | 16,9 s | 5,8 s | 4,0 s (6.690/6.850) | 0 | ET 17,20 s | quebra 18,6 s | ok | ok | 0,61 s |
| Saveiro | 6.300 → 6.350 → 6.600 | ok | 14,2 s | 5,6 s | 3,8 s (6.490/6.636) | 0 | ET 17,41 s | quebra 10,2 s | ok | ok | 0,56 s |
| Astra | 6.700 → 6.750 → 7.100 | ok | 15,0 s | 8,1 s | 3,9 s (6.981/7.164) | 0 | ET 16,09 s | quebra 11,6 s | ok | ok | 0,61 s |
| 208 GT | 6.700 → 6.750 → 7.100 | ok | 4,8 s | 3,6 s | 2,6 s (7.038/7.180) | 0 | ET 14,60 s | quebra 8,4 s | ok | ok | 0,63 s |
| Golf GTI | 7.000 → 7.050 → 7.400 | ok | 7,6 s | 4,8 s | 3,1 s (7.329/7.495) | 0 | ET 14,74 s | quebra 9,9 s | ok | ok | 0,78 s |
| A3 1.8T | 7.000 → 7.050 → 7.400 | ok | 7,6 s | 4,8 s | 3,1 s | 0 | ET 14,84 s | quebra 9,3 s | ok | ok | 0,78 s |
| C200 | 6.700 → 6.750 → 7.100 | ok | 5,8 s | 4,1 s | 2,9 s (7.045/7.153) | 0 | ET 14,47 s | ET 14,54 s (0 %)¹ | ok | ok | 0,73 s |
| 320i | 7.200 → 7.250 → 7.600 | ok | 5,3 s | 4,2 s | 3,0 s (7.537/7.632) | 0 | ET 14,31 s | ET 14,32 s (0 %)¹ | ok | ok | 0,73 s |
| Civic Si | 8.600 → 8.650 → 9.000 | ok | 33,4 s | 8,8 s | 4,1 s (8.834/9.066) | 0 | ET 15,07 s | quebra 10,1 s | ok | ok | 0,46 s |
| Jetta TSI | 6.900 → 6.950 → 7.300 | ok | 7,5 s | 4,9 s | 3,1 s (7.208/7.398) | 0 | ET 14,34 s | ET 14,56 s (0 %)¹ | ok | ok | 0,73 s |
| Evo X | 7.400 → 7.450 → 7.800 | ok | 5,2 s | 4,1 s | 3,0 s (7.741/7.936) | 0 | ET 12,66 s | ET 12,66 s (0 %)¹ | ok | ok | 0,86 s |
| 335i | 7.200 → 7.250 → 7.600 | ok | 7,3 s | 5,1 s | 3,3 s (7.525/7.676) | 0 | ET 13,04 s | ET 13,22 s (4 %)¹ | ok | ok | 0,83 s |

¹ Câmbio automático / DCT: a caixa sobe a marcha sozinha no corte, então "segurar a marcha" não acontece.

### Leitura

- Corte original segurado 30 s: nunca quebra (risco 0 %). Trocas certas com o corte crítico: nunca quebra.
- Corte crítico segurado: 2,6–4,1 s (meta 2–4 s; quatro carros clássicos ficam até 0,1 s acima).
- Agressivo: 3,6–8,8 s (meta 4–6 s; Uno, Astra e Civic ficam acima). Esportivo: 4,8–33 s (meta 8–12 s). A grade de
  50 rpm do corte num intervalo de só 250–350 rpm deixa poucas posições, e no Civic o limitador cai mais.
- Trocas atrasadas (1,5 s no corte) em câmbio manual quebram antes da chegada em 9 de 12 carros; Uno, Chevette e Corsa chegam
  com 82–99 % de risco.
- O ciclo do limitador nunca reduz o risco enquanto o motor está segurado (0 quedas em todos).
- Recuperação: depois de 10 s em marcha lenta o risco volta a 0.
- Reforço (molas + forjados): o mesmo corte crítico fica seguro.
- Limitações: o boost quase não pesa no limitador em neutro (carga baixa); o tempo "extremo" é do modelo (x = 2,5),
  não de uma redução de marcha simulada.
