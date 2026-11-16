# Admissão: correção do chiado (canal `intake`)

## Causa (medida)

Medição por componente (`intakeTone`, `intakeHiss`, `intakeRoar`) com a física real (`scripts/audio-intake-physics.ts`),
a plena carga perto do redline, 48 kHz, tabelas completas em `before-physics-*.txt`:

| Motor | tom AC (Pa) | hiss (Pa) | roar (Pa) | ruído/tom | centróide | energia >4 kHz |
|---|---|---|---|---|---|---|
| arco-1600 (4 cil, NA) | 3368 | 3 | 86 | −32 dB | 234 Hz | 0 % |
| lince-gt (6 cil, NA) | 320 | 6 | 644 | **+6 dB** | **3293 Hz** | **23 %** |
| kronos-v8 | 147 | 4 | 928 | **+16 dB** | **3847 Hz** | **28 %** |
| tempest-v8 | 193 | 11 | 1043 | **+15 dB** | **3764 Hz** | **27 %** |

O chiado vem do **`roar`** (turbulência da caixa, ∝ v⁴, sem limite), que em V6/V8 supera o sinal periódico
(a soma das sucções de 6–8 cilindros num único duto deixa o AC físico 20–27 dB abaixo do 4 cilindros).
O `hiss` da borboleta é pequeno (≤ 11 Pa) e `intakeSig` não tem energia aguda. Nenhuma amostra chega ao softClip
(norm.pk ≤ 0,16): não é saturação. Os motores de 4 cilindros já estavam corretos.

## Correção (`EngineAcoustics.ts`)

- `roar`: intensidade física de Lighthill só *conduz* uma curva saturante `x/(1+x)` até um teto em Pa (`ROAR_MAX_PA`);
  espectro com corte ∝ Strouhal·v/D (350–1500 Hz) e −12 dB/oit acima; ganho e corte suavizados; modulação pelas pulsações.
- `hiss`: depende da queda de pressão na borboleta usando a pressão a montante correta (ambiente + boost nos turbo),
  vezes o fluxo²; banda 1,5 kHz com corte em 2,5 kHz (era 3,2 kHz fixo); resíduo natural em WOT.
- Geradores de ruído separados por fonte (`hissRng`, `roarRng`); `reset()` agora limpa todos os filtros e suavizadores da admissão.
- Não alterados: waveguide do duto, Helmholtz, mistura `0,25/0,15` e `0,7/0,3` do tom (a medição mostrou harmônicos do
  tom a 98 % em motores em linha, nada a corrigir), normalização `CH.intake`, canais turbo/escapamento/pneus/ambiente.
  Tentei um duto por banco nos V, mas o sistema é linear e idêntico: somava exatamente o mesmo sinal, então foi removido.

## Resultado (física real, plena carga, 48 kHz; `after-physics-*.txt`)

| Motor | ruído/tom | centróide | energia >4 kHz |
|---|---|---|---|
| arco-1600 | −36 dB | 232 Hz | 0 % |
| lince-gt | −6 dB | 790 Hz | 0 % |
| kronos-v8 | +2 dB | 943 Hz | 2 % |
| tempest-v8 | 0 dB | 1060 Hz | 2 % |

44,1 kHz e qualidade baixa: `after-physics-44100.txt`, `after-physics-lowquality-48000.txt`.
WAVs com volume equalizado: `before/` e `after/` (`intake-<tag>-<carro>-{full,pulses,hiss,roar}.wav`).

## Limites

- Não ouvi os WAVs nem testei no Developer Lab/Sandbox. Só medi.
- No V6/V8 o `roar` ainda é igual ou maior que o tom AC (que é fisicamente fraco nesse modelo); agora está abaixo de 1,5 kHz.
- A admissão dos V8 ficou ~6 dB mais baixa que antes (o chiado emprestava volume); se soar fraca, ajuste `intakeGain` do carro ou `ROAR_MAX_PA`.
- Sem variantes de admissão (original/esportiva/direta) no código: o timbre já responde ao volume da caixa e ao comprimento do duto (testado), mas não há presets.
