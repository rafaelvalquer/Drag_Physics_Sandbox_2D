# Calibração mecânica — Capítulo 2

Gerado com `npx tsx scripts/calibrate-chapter2.ts` (dinamômetro do motor a 1/120 s, carga plena, varredura de 100 em 100 rpm; arrancada no `test-track`, piloto automático com troca no corte). O teste `tests/unit/vehicles/chapter2.test.ts` repete a varredura do dinamômetro e falha se o pico de potência ou de torque se afastar mais de **5 %** do valor documentado.

**Regra seguida:** as curvas vêm da geometria do motor (diâmetro × curso, taxa, comandos, eficiência volumétrica e mapa do turbo). Nenhum torque foi multiplicado para acertar tempo de arrancada. Quando o tempo simulado ficou longe da ficha, o ajuste foi feito em dado físico com fonte ou estimativa declarada: relação de câmbio, massa, pneu, conversor de torque ou embreagem.

## Dinamômetro × ficha

| Carro | Motor | Documentado | Dinamômetro | Desvio cv / N·m |
|---|---|---|---|---|
| Chevrolet Astra 2.0 2011 | GM Família II 2.0 8V flex | 140 cv @ 5600 · 193 N·m @ 2600 | 140,1 cv @ 5700 · 193 N·m @ 2600 | +0,1 % / 0 % |
| Peugeot 208 GT 2017 | PSA Prince 1.6 THP | 173 cv @ 6000 · 240 N·m (24,5 kgfm) 1400–3500 | 173,0 cv @ 6000 · 240 N·m @ 3500 | 0 % / 0 % |
| VW Golf GTI 1.8T 2003 | EA113 1.8 20V turbo | 180 cv @ 5500 · 235 N·m 1950–5000 | 180,4 cv @ 5600 · 235 N·m | +0,2 % / 0 % |
| Audi A3 1.8T 2005 | EA113 1.8 20V turbo | 180 cv @ 5500 · 235 N·m | 180,4 cv @ 5600 · 235 N·m | +0,2 % / 0 % |
| Mercedes C200 W205 2015 | M274 2.0 turbo | 184 cv @ 5500 · 300 N·m (30,6 kgfm) 1200–4000 | 185,0 cv @ 5200 · 300 N·m @ 4000 | +0,5 % / 0 % |
| BMW 320i F30 2014 | N20 2.0 turbo | 184 cv @ 5000 · 270 N·m 1250–4500 | 184,5 cv @ 5100 · 270 N·m @ 4500 | +0,3 % / 0 % |
| Honda Civic Si 2008 | K20Z3 2.0 i-VTEC | 192 cv @ 7800 · 188 N·m (19,2 kgfm) @ 6100 | 192,0 cv @ 7800 · 188 N·m @ 6100 | 0 % / 0 % |
| VW Jetta TSI 2012 | EA888 2.0 TSI | 200 cv 5100–6000 · 280 N·m 1700–5000 | 200,6 cv @ 5900 · 280 N·m @ 5000 | +0,3 % / 0 % |
| Mitsubishi Evo X 2012 | 4B11T 2.0 turbo | 295 cv @ 6500 · 366 N·m (37,3 kgfm) @ 3500 | 295,4 cv @ 6600 · 366 N·m @ 3500 | +0,1 % / 0 % |
| BMW 335i F30 2013 | N55 3.0 6 em linha turbo | 306 cv 5800–6000 · 400 N·m 1200–5000 | 306,0 cv @ 5800 · 400 N·m @ 5000 | 0 % / 0 % |

Nos motores turbo, o "platô" de torque da ficha aparece no dinamômetro como uma faixa praticamente plana. O pico numérico cai no fim dessa faixa porque o simulador mede a carga plena com o turbo já cheio. A rotação de potência máxima fica a até 100 rpm da documentada, que é o passo da varredura.

## Desempenho simulado × declarado

| Carro | 0–100 declarado | 0–100 simulado | 402 m simulado | Vmáx declarada | Vmáx simulada | Observação |
|---|---|---|---|---|---|---|
| Astra 2011 | 9,6 s (estimado) | 9,28 s | 16,70 s | 198 km/h | 214 km/h | Vmáx acima: o Cx do Astra é estimado (`estimate-chapter2-aero`). |
| 208 GT 2017 | 7,7 s | 7,63 s | 15,54 s | 220 km/h | 232 km/h | |
| Golf GTI 2003 | 7,9 s | 7,76 s | 15,64 s | 222 km/h | 224 km/h | |
| A3 1.8T 2005 | 7,9 s (estimado) | 7,90 s | 15,74 s | 228 km/h | 234 km/h | Sem ficha nacional por URL; o 0–100 está marcado como estimado. |
| C200 2015 | 7,3 s | 7,46 s | 15,52 s | 235 km/h | 240 km/h | Conversor 7G-TRONIC; 1ª troca em 5450 rpm pela lógica do câmbio. |
| 320i 2014 | 7,3 s | 7,21 s | 15,36 s | 235 km/h | 231 km/h | ZF 8HP |
| Civic Si 2008 | 7,4 s | 7,83 s | 15,68 s | 220 km/h | 241 km/h | 0–100 a +6 %: o torque baixo do K20 abaixo do VTEC é o da ficha e não foi aumentado. |
| Jetta TSI 2012 | 7,3 s | 7,04 s | 15,14 s | 238 km/h | 244 km/h | DSG DQ250 |
| Evo X 2012 | 5,3 s | 5,32 s | 13,66 s | 242 km/h | 261 km/h | Vmáx acima: área frontal estimada. |
| 335i 2013 | 5,5 s | 5,53 s | 13,71 s | 250 km/h (limitada) | 282 km/h | O limitador eletrônico de 250 km/h não é modelado. Numa pista de 402 m isso é irrelevante, porque o carro cruza a ~170 km/h. |

Os tempos de 0–100 ficam dentro de ±4 % do declarado, exceto o Civic Si (+6 %, explicado acima). Os desvios de velocidade máxima vêm da aerodinâmica estimada. Isso não afeta a arrancada de 201/402 m, que é o objeto do jogo.

## Câmbios e tração

- **Automático com conversor (C200, 320i, 335i).** Usa `TorqueConverter` (fator K, razão de torque no estol, *lock-up* a partir da 2ª marcha) e lógica de troca automática com *kickdown*. O modo M é implícito: qualquer pedido de troca põe o câmbio em manual; o neutro devolve para D.
- **Dupla embreagem (Jetta, Evo).** `PowershiftController` faz a troca sem corte de torque: uma embreagem abre enquanto a outra fecha.
- **AWD (Evo).** Diferencial central com acoplamento controlado (ACD) e divisão de torque, com fonte `literature-s-awc`. A peça "awd-center-tune" altera só a rigidez do acoplamento, nunca o torque do motor.
- **Relações.** Vêm das fontes listadas em `vehicle-sources.md`. Quando estimadas, aparecem como `estimated` no código e com fonte `estimate-chapter2-gearing`.
