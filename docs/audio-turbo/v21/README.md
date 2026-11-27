# Turbo Acoustics 2.1

## Comparação para homologação

Os quatro WAVs de cada carro usam a mesma sequência simulada de largada, aceleração com
trocas, alívio, retomada e carga parcial. O canal de turbo é equiparado pelo nível
ponderado A ao longo dessa sequência e todos os arquivos de um mesmo grupo recebem
o mesmo ganho final contra saturação. As faixas com o sufixo `-veiculo` incluem motor,
escape, transmissão, pneus e ambiente. As faixas de rotor antes do duto usam uma
referência de ganho em comum para comparar o peso de cada ordem. `rotor-v21.wav`
isola o rotor após o duto e usa ganho próprio para a escuta.

| Carro | A — Legado | B — Turbo 2.0 | C — Harmônicos reduzidos | D — Rotor híbrido |
|---|---|---|---|---|
| [Gol AP Turbo](vw-gol-gts-1988/) | [A](vw-gol-gts-1988/a-legado.wav) | [B](vw-gol-gts-1988/b-turbo-2.wav) | [C](vw-gol-gts-1988/c-harmonicos-reduzidos.wav) | [D](vw-gol-gts-1988/d-rotor-hibrido.wav) |
| [BMW 320i](bmw-320i-f30-2014/) | [A](bmw-320i-f30-2014/a-legado.wav) | [B](bmw-320i-f30-2014/b-turbo-2.wav) | [C](bmw-320i-f30-2014/c-harmonicos-reduzidos.wav) | [D](bmw-320i-f30-2014/d-rotor-hibrido.wav) |
| [Nissan GT-R](nissan-gtr-r35-2015/) | [A](nissan-gtr-r35-2015/a-legado.wav) | [B](nissan-gtr-r35-2015/b-turbo-2.wav) | [C](nissan-gtr-r35-2015/c-harmonicos-reduzidos.wav) | [D](nissan-gtr-r35-2015/d-rotor-hibrido.wav) |

No Sandbox, abra **Turbo: comparação A/B/C/D (dev)**. O seletor muda apenas o
canal de turbo, com uma transição de 40 ms. O ajuste de nível usa a calibração
do carro e da qualidade quando disponível. O perfil de hardware serve de referência
para as demais combinações. Para medir os ganhos originais, desmarque **Equalizar nível
da comparação**. Cada ganho pode ir a zero, inclusive 2X, 3X, BPF, ruído de banda estreita,
modulação, pulsação e cada ressonância disponível. O controle **Duto completo** inclui
a atenuação da admissão. Zerar somente as ressonâncias mantém essa atenuação.

## Leituras

A matriz mede 29 builds que cobrem os 13 perfis, nas duas qualidades e nas três
taxas de amostragem. A cobertura registra 164 combinações aceitas pelo resolvedor
de preparação.

- [Relatório de nível e tonalidade](relatorio.md)
- [Métricas a 48 kHz](report-48000.json)
- [Métricas a 44,1 kHz](report-44100.json)
- [Cenário adicional a 32 kHz](report-32000.json)
- [Diagnóstico isolado dos três carros a 48 kHz](diagnostico-48000.json)
- [Matriz de perfis e de hardware](perfis.json)

As janelas de análise acompanham rotação do motor, rotação de cada rotor, pressão,
acelerador e aceleração do rotor. A energia é quadrática, a largura contém os 90%
centrais da energia na faixa da ordem e a proeminência compara o pico ao nível das
bandas vizinhas. A largura durante spool também inclui o deslocamento da ordem na janela.
O relatório separa a medição em carga parcial e em torno do pico físico de pressão.
A planicidade espectral permanece auxiliar.

## Diagnóstico do timbre

No ponto isolado de 48 kHz, o 2X do modelo B ficou acima do 1X em **3,9 dB no Gol**,
**4,6 dB na BMW** e **5,7 dB no GT-R**. Em D, o 2X ficou respectivamente **6,4 dB**,
**8,5 dB** e **8,1 dB abaixo** do 1X. A largura central de energia do 1X passou de
18 para 94 Hz no Gol, de 18 para 111 Hz na BMW e de 47 para 135 Hz no GT-R.

As ordens discretas continuaram estreitas quando se desativaram as ressonâncias em B.
Reduzir os harmônicos em C mudou o equilíbrio entre as ordens. Zerar também o 3X
teve efeito inferior a 0,04 dBA nesse ponto isolado. Esses resultados indicam como
causa provável do caráter de sino o conjunto de ordens estreitas com 2X forte,
reforçado durante o spool. A contribuição da modulação e dos dutos varia com a
carga, a admissão e a posição das ordens.

O rotor híbrido usa a rotação física como portadora e combina tom coerente com duas
componentes estocásticas filtradas em quadratura. A potência atribuída ao BPF diminui
antes de Nyquist, com margem para as bandas laterais. O perfil mantém os dois rotores
independentes no biturbo, inclusive a diferença de rotação, a fase e as sementes.

No teste isolado do GT-R, a diferença de rotação correspondeu a um batimento de
33,55 Hz no 1X. A profundidade do pico de batimento caiu de −4,5 dB em B para
−18,7 dB em D, em relação ao envelope médio. O ensaio usou os mesmos valores de
rotação em B e D para cada rotor.

Em um benchmark local a 48 kHz com o Gol em qualidade alta e o GT-R em baixa,
renderizar os sete canais das duas vozes consumiu 255 ms por segundo de áudio em B
e 286 ms em D (+12,5%). O número usa o melhor de cinco renders intercalados após
aquecimento, sobre os mesmos quadros da física. A matriz JSON registra também o
custo por voz e por condição. Nas linhas com exportação de faixas, esse tempo
inclui a captura de áudio para o relatório.

## Referências e aprovação

Medições em bancada mostram ordens síncronas e passagem das pás em determinados
regimes e maior participação do ruído de fluxo em outros. Isso orienta manter a
identidade tonal e comparar condições de operação distintas. [Figurella et al., ensaio de compressor automotivo](https://mae.osu.edu/media/document/2021-12-03/j91.pdf)

A posição de medição no duto também influencia a energia medida na passagem das pás.
Os valores publicados servem de referência qualitativa para a relação entre compressor
e admissão. [Sriganesh et al., medições na admissão do compressor](https://saemobilus.sae.org/articles/circumferential-variation-noise-blade-pass-frequency-a-turbocharger-compressor-ported-shroud-2021-01-1044)

O proprietário do jogo aprovou o modelo D (rotor híbrido) em 27 de novembro de 2026.
A aprovação se refere à revisão de áudio `d2a3884`. Os arquivos A/B/C/D ficam
disponíveis para comparar o assobio em subida de pressão, a textura em carga
estabilizada e a presença do motor na mixagem completa.

Para regenerar os arquivos e os ganhos do Sandbox:

```powershell
node --import tsx scripts/audio-turbo-report.ts --write-levels
```
