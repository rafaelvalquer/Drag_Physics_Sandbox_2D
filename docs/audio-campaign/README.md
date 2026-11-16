# Capítulo 1 — integração e auditoria acústica

## Fonte da verdade

- **Carros originais:** `src/data/cars/campaign.ts`; objetos imutados pelos modos livres.
- **Catálogo livre:** `SANDBOX_CARS` e `LAB_CARS` em `src/data/cars/index.ts`. Deduplicação por ID.
- **Preparações:** `src/data/cars/sandboxPresets.ts`. Marcos usa literalmente as peças, a pintura e o tune da definição do rival em `CareerEvents.ts`. Outros presets são resolvidos mecanicamente pelo mesmo `BuildResolver`.
- **Áudio:** `carToAcousticConfig` lê o `CarConfig` efetivo. Não há biblioteca de motores artificiais específica para o Sandbox.

## Matriz de veículos

| Veículo | Original | Aspirado preparado | Turbo |
| --- | --- | --- | --- |
| Fiat Uno Mille FIASA 1.0 | Disponível | Filtro esportivo (teste) | Incompatibilidade não superada: não oferecer como pronto |
| Chevrolet Celta Família I VHC 1.0 | Disponível | Filtro esportivo (teste) | Incompatibilidade não superada: não oferecer como pronto |
| Chevette 1.6/S etanol, tração traseira | Disponível | Rival Nando | Incompatibilidade não superada: não oferecer como pronto |
| Corsa 1.4 EFI | Disponível | Rival Beto | Incompatibilidade não superada: não oferecer como pronto |
| Kadett 1.8 | Disponível | Rival Paula | Incompatibilidade não superada: não oferecer como pronto |
| Saveiro AP 1.8 gasolina | Disponível | Base original e peças do rival | **Marcos Turbo, peça por peça** |
| Gol GTS AP 1.8S etanol (referência) | Disponível, único ID | Rival Léo | Turbo de teste **somente se** o BuildResolver aceitar |

Os estados dos presets são verificados em tempo de execução; preparações reprovadas ficam em `SANDBOX_PRESET_REJECTIONS`. Não são alterados combustível, compressão, embreagem ou limitações mecânicas para contornar um bloqueio.

## Auditoria de configuração

Os motores brasileiros continuam com seus próprios modelos de ignição, ordem angular de combustão, diâmetro, curso, compressão, comando, coletor de admissão e geometria do escapamento, na respectiva definição `src/data/engines/*` e `src/data/cars/*`.

A mixagem original usa ganhos individuais em cada `periodAcoustic({...})`, não um único preset para todos. O canal turbo dos motores NA tem ganho zero e é inativo na síntese. O turbo instalado pelo resolver ativa o canal baseado nos campos físicos de pressão, rotação do eixo e fluxo de BOV; o manômetro do HUD lê a mesma simulação.

## Como gerar relatórios e WAVs

```bash
npm ci
npx tsx scripts/audio-calibrate.ts --scope campaign --variant stock --quality high --rate 48000 --wav docs/audio-campaign/generated --tag before
npx tsx scripts/audio-calibrate.ts --scope campaign --variant turbo-build --quality high --rate 48000 --wav docs/audio-campaign/generated --tag after
npx tsx scripts/audio-intake-physics.ts --scope campaign --variant stock --quality low --rate 44100
npx tsx scripts/audio-intake-lab.ts --scope campaign --variant stock --quality high --rate 48000 --wav docs/audio-campaign/intake
```

O calibrador gera JSON por carro/preparação, contendo RMS, pico e RMS pré-normalização dos **sete canais**, centroide espectral, energia relativa nas quatro bandas (<500 Hz, 500–1500 Hz, 1500–4000 Hz, >4000 Hz), carga e pressão **medidas na física**, rotação média, rotação máxima do eixo turbo, fluxo BOV, saturação da admissão e escape, custo CPU, erros não finitos, frames rejeitados, resincronizações e eventos de pós-combustão. Gera WAV separado para cada canal e `mix` com RMS igualado (0,09) para comparações auditivas.

O workflow `P1 Brazilian cars and audio` executa a matriz High/Low e 44,1/48 kHz, preservando os relatórios e os WAVs High/48 kHz como **artefatos de GitHub Actions**, sem versionar dezenas de megabytes de dados binários.

## Interpretação dos relatórios

1. Compare o mesmo motor e trecho sob condição equivalente, não imponha RMS idêntico entre modelos.
2. Observe pulso/ruído nos testes separados de admissão e escape (`scripts/audio-intake-lab.ts`, `scripts/audio-exhaust-lab.ts`).
3. Não altere `EngineAcoustics.ts`, `AuxAcoustics.ts` nem os ganhos globais sem evidência de regressão.
4. Alterações de `periodAcoustic` exigem comparar resultados antes/depois sob o mesmo sample rate, qualidade e nível percebido.

## Limitações

- Os relatórios acima são gerados no CI, **não representam homologação por escuta humana**. A comparação auditiva com gravações de referência reais e a análise de assinatura sonora dependem de avaliação humana.
- O render offline mede o DSP com frames físicos, mas **não** mede starvation real do AudioWorklet em todos os dispositivos; os testes no navegador verificam ciclo de vida das vozes.
- O modo `--short` do CI percorre os trechos rapidamente para regressão; medições detalhadas exigem a execução sem `--short`.
- Os arquivos WAV antes/depois exigem duas revisões distintas: `--tag` apenas identifica a revisão, não simula uma calibração antiga.
