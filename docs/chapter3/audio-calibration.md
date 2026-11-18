# Calibração de áudio por motor — Capítulo 3

Relatório completo, gerado por `npx tsx scripts/audio-chapter3.ts all --wav docs/chapter3/audio --report docs/chapter3/audio/spectral-report.md`: [`audio/spectral-report.md`](audio/spectral-report.md). Os WAVs (fase de marcha lenta, aceleração livre, corrida de 402 m e desaceleração, com a física real e o mesmo `DragAI` das corridas) estão em:

- `audio/before/` — 48 kHz, o V6 genérico (ganhos padrão, escape único, mesma geometria);
- `audio/after/` — 44,1 e 48 kHz, a configuração final de cada carro.

Cada motor foi medido em qualidade *high* e *low* com: custo de CPU, *resets* por NaN, *clipping*, cliques, energia por bandas, centroide, energia acima de 4 kHz (o "chiado"), a relação entre a ordem de ignição e as meias ordens e o comportamento da válvula de alívio.

## O que este relatório prova e o que ele não prova

**Prova** (medições automáticas, repetíveis): a ordem de ignição e a geometria de cada V6 estão corretas na síntese; o som acompanha o RPM físico; o V6 de 90° tem assinatura própria; o aspirado não tem ruído de turbo; o biturbo responde à carga; nada satura nem corta; o custo de CPU é de 9–13 % do tempo real por voz.

**Não prova a fidelidade perceptiva.** A meta do plano é "alta fidelidade perceptiva, calibrada com gravações de referência". Este trabalho não tinha acesso a gravações reais dos oito carros (e não se embute áudio de terceiros): a comparação auditiva com os carros originais **não foi feita**. O que existe são os WAVs para que uma pessoa compare de ouvido e ajuste os ganhos de `acoustic`/`exhaust` de cada carro. Nenhum número deste documento deve ser lido como "soa como o carro real".

## Resultado por motor (48 kHz, qualidade *high*; "antes" = V6 genérico com escape único)

| Motor | >4 kHz antes → depois | Centroide antes → depois | CPU depois (varia ±2 pontos com a carga da máquina) | Válvula de alívio (pico no alívio) |
|---|---|---|---|---|
| VQ35DE (350Z) | 0,5 % → 0,5 % | 474 → 484 Hz | 9,9 % | aspirado |
| 2GR-FSE (IS 350) | 0,2 % → 0,6 % | 446 → 574 Hz | 9,7 % | aspirado |
| VQ37VHR (370Z) | 0,4 % → 0,6 % | 482 → 484 Hz | 9,6 % | aspirado |
| M276 biturbo (C 43) | 7,3 % → 4,2 % | 1313 → 962 Hz | 12,8 % | 0,106 → 0,053 |
| Lambda II biturbo (Stinger) | 9,0 % → 5,4 % | 1590 → 1163 Hz | 10,5 % | 0,097 → 0,051 |
| F160 biturbo (Ghibli) | 7,9 % → 4,2 % | 1340 → 951 Hz | 10,3 % | 0,106 → 0,053 |
| 690T biturbo (Giulia) | 5,4 % → 2,6 % | 949 → 721 Hz | 11,7 % | 0,107 → 0,056 |
| VR38DETT biturbo (GT-R, escape único) | 8,9 % → 3,1 % | 1668 → 839 Hz | 9,5 % | 0,107 → 0,067 |

Em todas as medições: *resets* por NaN zero, *clipping* zero. O chiado dos turbos de fábrica ficou entre 2,6 % e 5,4 % acima de 4 kHz.

## O V6 de 90° não soa como um V6 de 60°

O teste das ordens (a 3.000 rpm, bancadas fundidas no escape único do "antes") separa a **ordem de ignição** (3ª ordem num V6) das **meias ordens**:

| Motor | Ordem de ignição | Meias ordens | Δ |
|---|---|---|---|
| Os sete V6 a 60° (disparo uniforme de 120°) | −44,5 a −49,2 dB | −59,5 a −65,1 dB | **+14 a +17 dB** (as meias ordens quase não existem) |
| 690T a 90° (disparo 90°/150°) | −58,2 dB | −40,6 dB | **−17,6 dB** (as meias ordens dominam) |

É a assinatura da ordem 1,5 do V6 de 90° com moentes compartilhados, que a fonte descreve como a de um três-em-linha. Os ângulos de ignição do 690T são `[90, 150, 90, 150, 90, 150]` (`firingIntervalsDeg`), a bancada de cada cilindro segue os pares que compartilham moente ((1,6), (3,4), (2,5)), e `bankAngleDeg` é 90, não 60: a configuração acústica não reaproveita a do V6 de 60°. O teste `chapter3.test.ts` confere os intervalos de cada motor.

Com o escape **dual** do carro (coluna "depois" do relatório completo) as meias ordens dominam em todos os V6, porque o modelo de escape duplo ouve a linha próxima mais forte que a distante (a distante chega 4 ms depois, 0,62× e filtrada): é o efeito de dois tubos soltos, sem comunicação, que não se mistura. O GT-R, que tem um silencioso central (uma saída para quatro ponteiras), usa o escape **único**, e por isso sua medição final (ordem de ignição −46,4 dB, meias ordens −61,3 dB, Δ +14,9 dB) é a de um V6 uniforme com as bancadas misturadas; os outros sete usam duplo.

## O que mudou no motor de áudio

1. **Turbo paralelo.** `AuxAcoustics` ganhou o segundo assobio do compressor: dois rotores que nunca giram exatamente iguais (`ROTOR_MISMATCH` 1,5 %) batem entre si, e cada um leva 60 % do nível, porque o fluxo de ar é dividido; um turbo único não é duplicado cegamente. O quadro de telemetria de áudio ganhou `turboShaftRpm2`.
2. **V6 aspirados sem turbo.** `turboGain` é 0: o canal do turbo fica mudo (testado).
3. **Escapes, admissões e ganhos individuais.** Cada carro tem seu `ExhaustConfig` (comprimento e diâmetro dos primários, coletor, câmaras do silencioso, absorção, ponteira) e seus ganhos de `acoustic`; o teste confere que os oito escapes e os oito conjuntos de ganhos são diferentes.
4. **Válvula de alívio recirculada** em todos os biturbo (válvula de fábrica): o jato fica no duto de admissão.

## Como o som de cada carro foi dirigido

| Carro | Direção da configuração | Estado |
|---|---|---|
| 350Z | V6 aspirado, admissão perceptível (`intakeGain` 0,95), escape duplo esportivo de primários longos | calibrado por métricas, **sem comparação com gravação** |
| IS 350 | silencioso e refinado: absorção 0,70, ganhos baixos | idem |
| 370Z | irmão mais agudo do 350Z: admissão 1,0, `exhaustGain` 1,1, corte a 7.500 rpm | idem |
| C 43 | biturbo esportivo, escape duplo de coletor longo, turbo 0,40 | idem |
| Stinger GT | refinado, presença de admissão e de turbo sob carga | idem |
| Ghibli S Q4 | biturbo com escape esportivo de coletor de 2,4 m | idem |
| Giulia QV | V6 de 90°, disparo irregular, escape duplo de primários curtos e coletor largo | idem |
| GT-R | VR38DETT: dois turbos, escape único (silencioso central), engrenagens da dupla embreagem mais audíveis (`transmissionGain` 0,5) | idem |

Os WAVs de `audio/after/` são o material de referência para ajuste auditivo.
