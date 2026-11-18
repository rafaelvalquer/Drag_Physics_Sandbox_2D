# Calibração mecânica — Capítulo 3

Gerado com `npx tsx scripts/dyno-chapter3-engines.ts` (só os motores) e `npx tsx scripts/calibrate-chapter3.ts` (dinamômetro e arrancada no `test-track`, piloto automático, troca no corte). O teste `tests/unit/vehicles/chapter3.test.ts` repete a varredura do dinamômetro e falha se o pico de potência ou de torque se afastar mais de **5 %** do valor documentado.

**Regra seguida (a mesma dos capítulos anteriores):** as curvas vêm da geometria do motor e dos pontos publicados; nenhum torque foi multiplicado para acertar tempo. Onde o tempo simulado ficou longe da ficha, o ajuste foi feito em **dado físico declarado como calibrado** — aderência do pneu (`tires.muPeak`) e o fator K do conversor — nunca na potência.

## Dinamômetro × ficha (valores convertidos de hp e lb-ft)

| Carro | Motor | Documentado | Dinamômetro | Desvio cv / N·m |
|---|---|---|---|---|
| Nissan 350Z 2006 | VQ35DE Rev-Up | 300 hp = 304,2 cv @ 6400 · 260 lb-ft = 352,5 N·m @ 4800 | 304,2 cv @ 6500 · 353 N·m @ 4800 | 0 % / 0 % |
| Lexus IS 350 2015 | 2GR-FSE | 306 hp = 310,2 cv @ 6400 · 277 lb-ft = 375,6 N·m @ 4800 | 313,9 cv @ 6700 · 376 N·m @ 4800 | +1,2 % / 0 % |
| Nissan 370Z 2014 | VQ37VHR | 332 hp = 336,6 cv @ 7000 · 270 lb-ft = 366,1 N·m @ 5200 | 336,6 cv @ 7000 · 366 N·m @ 5200 | 0 % / 0 % |
| Mercedes-AMG C 43 2017 | M276 biturbo | 362 hp = 367,0 cv @ 5500–6000 · 384 lb-ft = 520,6 N·m @ 2000–4200 | 368,7 cv @ 5700 · 521 N·m @ 4200 | +0,5 % / 0 % |
| Kia Stinger GT 2019 | Lambda II biturbo | 365 hp = 370,1 cv @ 6000 · 376 lb-ft = 509,8 N·m @ 1300–4500 | 372,0 cv @ 6300 · 510 N·m @ 4500 | +0,5 % / 0 % |
| Maserati Ghibli S Q4 2015 | F160 biturbo | 404 hp = 409,6 cv @ 5500 · 406 lb-ft = 550,5 N·m @ 4500–5000 | 409,8 cv @ 5600 · 551 N·m @ 5000 | 0 % / 0 % |
| Alfa Romeo Giulia QV 2017 | 690T biturbo | 505 hp = 512,0 cv @ 6500 · 443 lb-ft = 600,6 N·m @ 2500–5500 | 513,3 cv @ 6700 · 601 N·m @ 5500 | +0,3 % / 0 % |
| Nissan GT-R R35 2015 | VR38DETT biturbo | 545 hp = 552,6 cv @ 6400 · 463 lb-ft = 627,7 N·m @ 3200–5800 | 553,6 cv @ 6500 · 628 N·m @ 5800 | +0,2 % / 0 % |

A rotação de potência máxima fica a até 300 rpm da documentada: nos motores com platô de torque a curva é plana e o pico numérico cai em qualquer ponto do platô.

## Desempenho simulado × declarado

| Carro | 0–100 declarado | 0–100 simulado | 0–200 | 201 m | 402 m | Vmáx simulada | Observação |
|---|---|---|---|---|---|---|---|
| 350Z | 5,6 s (estimado) | 5,79 s (+3 %) | 19,9 s | 9,37 s | 14,10 s | 288 km/h | Sem limitador eletrônico modelado. |
| IS 350 | 5,8 s (0–60 mph 5,6 s) | 5,93 s (+2 %) | 19,8 s | 9,38 s | 14,07 s | 280 km/h | Limitado a 230 km/h na vida real. |
| 370Z | 5,1 s (estimado) | 5,34 s (+5 %) | 17,8 s | 9,07 s | 13,63 s | 300 km/h | |
| C 43 | 4,8 s (0–60 mph 4,6 s) | 4,33 s (**−10 %**) | 15,8 s | 8,19 s | 12,61 s | 306 km/h | Limitado a 209 km/h na vida real. |
| Stinger GT | 5,5 s (ficha europeia) | 4,88 s (**−11 %**) | 17,8 s | 8,56 s | 13,13 s | 289 km/h | A ficha europeia é conservadora; ver abaixo. |
| Ghibli S Q4 | 4,8 s | 4,58 s (−5 %) | 16,0 s | 8,38 s | 12,79 s | 299 km/h | |
| Giulia QV | 3,9 s (0–60 mph 3,8 s) | 4,09 s (+5 %) | 11,4 s | 7,93 s | 11,85 s | 326 km/h | A ficha é do carro com câmbio manual. |
| GT-R | ≈ 3,0 s (estimado) | 3,50 s (**+17 %**) | 11,5 s | 7,52 s | 11,51 s | 304 km/h | Ver abaixo. |

**Onde a simulação não acompanha a ficha, e por quê**
- **C 43 e Stinger (−10 %).** São tração integral: o 0–100 quase não depende da aderência do pneu (varrendo `muPeak` de 1,0 a 1,4 o tempo varia menos de 3 %) e sim da potência, da massa e das relações. Com a potência documentada, a simulação anda mais que o tempo declarado pelo fabricante. Esse tipo de número costuma ser conservador, mas essa é uma observação geral, não uma medição consultada. Não foi alterada a potência para encostar na ficha.
- **GT-R (+17 %).** Também tração integral: a aderência só importa abaixo de `muPeak` 1,2 (3,84 s com 1,0; 3,54 s com 1,2 e 3,46 s com 1,4); a partir daí é limitada por potência. Com 545 hp (552,6 cv) e 1.822 kg o carro não faz 3,0 s na física do jogo. A potência de 545 hp é a publicada; testes independentes costumam medir mais, mas o jogo não inventa. A vantagem do GT-R vem de motor, dupla embreagem e tração, como pede o plano, e não de aceleração artificial.
- **Vmáx.** Como na 335i do capítulo 2 (limitada a 250 km/h), os limitadores eletrônicos (IS 350 230 km/h, C 43 209 km/h) não são modelados, e Cx e área frontal estimados deslocam a velocidade máxima. Numa pista de 402 m isso é irrelevante.

## Calibrações físicas (todas marcadas como `calibrated` na proveniência)

| Carro | O que foi calibrado | Por quê |
|---|---|---|
| 350Z | `muPeak` 1,25 | Com 1,10 o V6 aspirado patina 1,9 s e faz 6,44 s; os 3,794 × 3,538 de relação exigem aderência alta. |
| 370Z | `muPeak` 1,30 | Idem; 370Z tem relação final 3,692. |
| IS 350 | conversor `kFactor` 110 | Com K ≥ 118 o conversor segura o motor abaixo da faixa útil nas duas primeiras marchas (7,0 s); com 110 o V6 chega ao corte e faz 5,93 s. |
| Giulia QV | `muPeak` 1,35 | Pneu traseiro de 285/30 R19 Pirelli P Zero Corsa; com 1,20 o tempo era 4,64 s. |
| GT-R | `muPeak` 1,25 | Tração integral: efeito pequeno (3,54 → 3,50 s). |

## Câmbio de nove marchas (C 43)

O esquema aceitava de quatro a oito marchas; `TransmissionSchema.gearRatios` agora aceita nove e `lockup.minGear` chega a 9. A auditoria cobriu o `Gearbox`, a decisão de troca automática (`autoShiftDecision`), o `DragAI`, o HUD (luzes de troca por marcha), o painel do dinamômetro e o cálculo de velocidade por marcha: todos usam `gearRatios.length`, sem constante embutida. Nenhum carro ganhou uma nona marcha que não tem. O teste de unidade confere que o C 43 chega à 8ª marcha numa corrida de 60 s e que as trocas sobem em ordem.

## Biturbo paralelo (cinco carros)

`TurboSchema` ganhou `layout: 'single' | 'parallel-twin'` (opcional: motores antigos e saves não mudam). No `Turbocharger`:

- cada bancada alimenta um rotor, com metade do fluxo contra metade da vazão de referência: a **velocidade-alvo de cada eixo é a de um turbo único**; o que o par muda é o rotor — menor e mais leve, ou seja, `spoolTimeS` (dado por rotor) menor;
- os dois compressores alimentam o mesmo plenum: a pressão é a **média** das duas (compressores em paralelo somam vazão, não razão de pressão), nunca a soma;
- o segundo rotor recebe `ROTOR_MISMATCH` = 1,5 % menos energia de escape (suposição: as bancadas nunca são idênticas): as velocidades dos dois eixos diferem alguns por cento durante o enchimento e o áudio pode soar dois assobios com batimento;
- a telemetria de áudio ganhou `turboShaftRpm2` (`AF.length` 24 → 25).

Os motores com um turbo só (I4/I6 do capítulo 2) e os V6 aspirados mantêm exatamente o comportamento anterior (testado).

## Oficina e confiabilidade

- Cada motor tem família própria (`nissan-vq35de`, `toyota-2gr-fse`, `nissan-vq37vhr`, `mercedes-m276`, `kia-lambda33`, `maserati-f160`, `alfa-690t`, `nissan-vr38dett`) em `ENGINE_FAMILIES` e em `ENGINE_RELIABILITY` (Blown Engine), com a fonte estimada de cada número.
- **V6 aspirados:** só aceitam as peças genéricas (pneus, peso, suspensão, arrefecimento, câmbio e embreagem compatíveis). Peças de motores antigos (`cam-k20`, `head-ported`, `ecu-stage1-na`…) e tudo de turbo aparecem como incompatíveis, com o motivo.
- **Biturbo:** toda a árvore (Stage 1/2/3, turbina híbrida, controle de pressão, intercooler, forjados, downpipe); o `at-upgrade` só no automático, o `dct-upgrade` só no GT-R, o `awd-center-tune` só nos integrais.

## Persistência e compatibilidade dos saves

O formato do save **não mudou** (continua na versão 2): o capítulo 3 só ampliou valores que o esquema já aceitava — o `chapterId` ganhou `chapter-3` na lista de capítulos, e o campo opcional `prizeEventId` do carro (do prêmio da final, do capítulo 1) cobre o GT-R. Por isso não há migração: um save que terminou o capítulo 2 antes do capítulo 3 existir continua válido, e o capítulo 3 abre pela **conclusão** do capítulo 2 (a lista `unlockedChapters` é sincronizada na carga e a cada resultado). O teste `chapter3.test.ts` confere que esse save mantém créditos, carros e eventos, que um `chapterId` desconhecido continua recusado e que o save antigo recebe o prêmio do GT-R só quando a final é vencida (uma vez). Nenhum save antigo é regravado com carros ou peças novos.
