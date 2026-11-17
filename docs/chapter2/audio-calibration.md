# Calibração de áudio por motor — Capítulo 2

Relatório completo, gerado por `npx tsx scripts/audio-chapter2.ts`: [`audio/spectral-report.md`](audio/spectral-report.md). As gravações de 8 s com o motor em carga plena estão em:

- `audio/before/` — 48 kHz, configuração antes da calibração;
- `audio/after/` — 44,1 e 48 kHz, configuração final.

Cada motor foi medido nas qualidades *high* e *low* com:

- custo de CPU em relação ao tempo real;
- *resets* por NaN, *clipping* e cliques (descontinuidade máxima);
- distribuição de energia por bandas e centroide espectral;
- energia acima de 4 kHz (o "chiado");
- separação entre a ordem de ignição e as meias ordens;
- comportamento da válvula de alívio;
- transição de came (só no K20).

## Resultado por motor (48 kHz, qualidade *high*)

| Motor | >4 kHz antes → depois | Centroide antes → depois | Ordem de ignição × meias ordens | Válvula de alívio |
|---|---|---|---|---|
| GM Família II 2.0 (Astra) | 1,1 % → 0,8 % | 508 → 454 Hz | Δ 26,6 dB | aspirado |
| Prince 1.6 THP (208 GT) | 22,4 % → 12,6 % | 3364 → 2029 Hz | Δ 24,5 dB | recirculada |
| EA113 1.8T (Golf) | 15,5 % → 8,9 % | 2316 → 1439 Hz | Δ 24,0 dB | recirculada |
| EA113 1.8T (A3) | 15,7 % → 8,3 % | 2344 → 1359 Hz | Δ 23,9 dB | recirculada |
| M274 2.0 (C200) | 20,6 % → 8,3 % | 3035 → 1424 Hz | Δ 25,4 dB | recirculada |
| N20 2.0 (320i) | 8,5 % → 3,5 % | 1090 → 671 Hz | Δ 25,4 dB | recirculada |
| K20Z3 i-VTEC (Civic Si) | 0,5 % → 0,4 % | 535 → 485 Hz | Δ 26,8 dB | aspirado |
| EA888 2.0 TSI (Jetta) | 16,3 % → 9,2 % | 2570 → 1625 Hz | Δ 24,2 dB | recirculada |
| 4B11T (Evo X) | 20,0 % → 8,8 % | 2723 → 1417 Hz | Δ 26,3 dB | recirculada |
| N55 3.0 I6 (335i) | 13,4 % → 5,6 % | 2228 → 1308 Hz | Δ 14,7 dB (seis cilindros, ver abaixo) | recirculada |

Em todas as medições:

- *resets* por NaN: zero;
- *clipping*: zero;
- CPU entre 6 % e 9,5 % do tempo real.

## O que mudou no motor de áudio

1. **Válvula de alívio recirculada** (`bovVent: 'recirculating'`, em `AuxAcoustics.ts`).
   - Antes: os motores modernos de fábrica soltavam o jato da válvula ao ar livre, um "tssss" de preparação.
   - Agora: o jato é filtrado por um passa-baixas de 1,4 kHz que representa o duto de admissão, e sai a ~35 % do nível. O pico do canal turbo no alívio caiu à metade (ex.: C200 0,107 → 0,048).
   -2. **Troca de came do K20 (i-VTEC)** (`variableCam`, em `EngineAcoustics.ts`).
   - O motor de áudio ganhou um segundo conjunto de eventos de válvula: tabelas de levantamento dos ressaltos altos, abertura e fechamento e área efetiva.
   - A ECU comanda a troca acima de 5800 rpm, com carga acima de 35 % e histerese de 200 rpm. Os pinos levam o tempo de atuação para travar, então os eventos de válvula cruzam de forma contínua.
   - Na corrida, a 6036 rpm, o centroide do escape vai de 382 para 404 Hz. O nível vai de −30,2 para −29,5 dB. O maior degrau de volume em 10 ms é 1,9 dB, ou seja, não há salto de volume na troca.
   - O travamento dos pinos soa como um clique mecânico curto no cabeçote (só na qualidade *high*).
   - O relatório conta 10 trocas de came na gravação (contador `camSwitches`).
3. **N55 seis em linha.**
   - Ordem de ignição 1-5-3-6-2-4, com fonte `literature-bmw-n55`.
   - Com seis cilindros, a ordem de ignição dominante é a 3ª, e as meias ordens ficam mais próximas dela do que num quatro cilindros. Daí o Δ de ~15 dB, que é a assinatura esperada de um I6 e não um defeito.
   - A distribuição por bandas (24 % / 65 % / 5 % / 6 %) concentra a energia na banda média, o "rasgado" característico.
4. **Chiado dos turbos de fábrica.**
   - Problema: a turbulência do jato de escape e o assobio do compressor somavam até 20–22 % acima de 4 kHz.
   - Correção: o ganho do canal turbo de cada motor moderno foi calibrado com a mesma limitação na fonte da correção do capítulo 1; no Evo X, o último ajuste foi `turboGain` 0,78 → 0,48. O resultado ficou entre 3,5 % e 12,6 % acima de 4 kHz.
   - O 208 GT continua o mais agudo (12,6 %): o Prince twin-scroll pequeno gira mais alto.

## Como reproduzir

```bash
npx tsx scripts/audio-chapter2.ts
```

O script grava os WAVs de `audio/after/`, mede o espectro e reescreve `audio/spectral-report.md`.
