# Campanha — Capítulo 1 "Madrugada Zero"

Modo **Campanha** (aba ao lado de Sandbox, Corrida e Dinamômetro). Sete noites em três regiões, um carro de rua
original e o que o jogador souber fazer com ele. Nada aqui altera os modos existentes: os carros da campanha
ficam fora das listas do Sandbox, as pistas noturnas são temas novos e o save é um store próprio no IndexedDB.

## Arquitetura

| módulo | papel |
|---|---|
| `src/modes/CareerMode.ts` | telas (menu, escolha, garagem, oficina, dinamômetro, noites, rival, corrida, resultado, final, histórico, classificados), diálogos, corrida visível |
| `src/game/career/CareerController.ts` | toda mudança no save: nova carreira, compra/instalação/remoção de peça, ajuste de turbo, compra de carro, registro de corrida, exportar/importar |
| `src/game/career/CareerState.ts` | `CareerSave` em zod (versão, slot, capítulo, créditos, reputação, carros, peças, eventos, prêmios, cenas vistas, resultados, revisão) e migração |
| `src/game/career/CareerRepository.ts` | leitura/escrita atômica (uma transação IDB por operação, revisão otimista) e trava entre abas (`navigator.locks`) |
| `src/game/career/CareerEvents.ts` | rivais e noites como dados (falas exatas, carro, peças, perfil de piloto, prêmio, desbloqueios) |
| `src/game/career/CareerStory.ts` | `StoryScene` com gatilho (início, oficina, pré-corrida, vitória, derrota, desbloqueio, desafio final, conclusão) |
| `src/game/career/CareerProgression.ts` | estados das noites, desbloqueios, requisitos das peças |
| `src/game/career/CareerRewards.ts` | prêmio de cada resultado |
| `src/game/career/CareerResultEvaluator.ts` | comentários da Nina a partir da telemetria medida |
| `src/game/career/RivalBuildFactory.ts` | carro do rival e do jogador, sempre pelo mesmo resolvedor |
| `src/game/career/headlessRace.ts` | a mesma corrida (RaceController + DragAI + física) sem renderizar, com telemetria — usada no balanceamento e nos e2e |
| `src/game/career/tuning/` | peças (`parts.ts`), modelo de respiração do motor (`breathingModel.ts`) e `BuildResolver` |
| `src/data/cars/*` e `src/data/engines/*` | os seis carros novos (o Gol GTS é o mesmo do Sandbox) — ver [vehicles/campaign-cars.md](vehicles/campaign-cars.md) |
| `src/data/tracks/career.ts` | Distrito Industrial, Baixada e Avenida Norte |
| `src/game/scenes/environmentCampaign.ts` | cenário noturno das três regiões |
| `src/ui/career/portraits.ts`, `career.css` | retratos dos oito personagens e estilos |

A corrida da campanha é a do modo Corrida: `RaceController` (árvore, largada em neutro, RT, ET, sensores, queima,
DNF, frenagem), `SimulationRunner`, HUD, som. O rival é um `DragAI` com o perfil de piloto do rival; o jogador
dirige com o teclado/toque como no modo Corrida. Não há relógio paralelo.

## Peças e física

Uma peça nunca soma potência: ela muda um parâmetro físico e a curva nova sai do modelo.

- **Respiração do motor** (`breathingModel.ts`): a partir do ponto de operação em plena carga do motor original
  (o mesmo `EngineModel`), cada peça muda a carga admitida — perda no filtro, gás residual pela contrapressão do
  escape, sintonia de Helmholtz dos dutos do coletor, efeito do comando (fechamento da admissão, levantamento,
  cruzamento) — e o bombeamento ((p_escape − p_coletor)·Vd/4π). A linha de Willans converte em torque.
- **Turbo**: ponto fixo com a pressão de regime do `Turbocharger` (compressor η 0,65, intercooler 0,6), retardo de
  ignição por detonação proporcional à pressão e à taxa de compressão (gasolina 0,10/bar, etanol 0,025/bar), perda
  máxima de 25 %. Gasolina acima de 10,5:1 ou etanol acima de 13:1 recusam o kit. Exige embreagem com 1,2× o torque
  de pico. Acrescenta 18 kg. Pressão ajustável de 0,4 a 1,0 bar nos preparadores.
- **Transmissão e pneus** mudam a configuração do carro (capacidade da embreagem, relação final, coeficientes de
  Pacejka, inércia, resistência ao rolamento, temperatura ideal).

| peça | preço | efeito físico | libera em |
|---|---:|---|---|
| Filtro esportivo | 250 CR | perda de carga do filtro 1,0 kPa | noite 1 |
| Escape dimensionado | 450 CR | contrapressão 7 kPa, coletor de escape ×1,08 | noite 1 |
| Coletor de admissão | 650 CR | dutos ×0,82 de comprimento, +4 mm de diâmetro, plenum ×1,3 | noite 2 |
| Pneus esportivos | 1000 CR | μ 1,13 (no mínimo +6 % sobre o original já na largada), B 11, C 1,5, E 0,35, mesma roda | noite 2 |
| Comando esportivo | 900 CR | admissão −6°/+12°, escape −8°/+8°, +1,3 mm de levante, corte +400 rpm | noite 3 |
| Embreagem reforçada | 900 CR | capacidade ×1,5, engate ×1,3, largada +100 rpm, inércia do câmbio −15 % e do motor −4 % | noite 4 |
| Diferencial alternativo | 1200 CR | relação final escolhida para o carro entre ×0,97 e ×1,12; eficiência +1 ponto | noite 4 |
| Pneus semislick | 1600 CR | μ 1,32 (no mínimo +16 % sobre o original já na largada, frio), roda forjada −0,03 kg·m² | noite 5 |
| Kit turbo básico | 4000 CR | turbina 0,6 bar (0,4–1,0 nos preparadores), intercooler, +18 kg | noite 4 |

Cada item da oficina tem também a **peça original de fábrica**: grátis, sempre disponível. Instalar a original
retira a modificação daquele item (o resolvedor devolve exatamente a física de fábrica dele) e manda a peça
comprada para o estoque do carro, de onde ela volta sem custo. "Restaurar tudo ao original" faz o mesmo em todos os
itens. Cada peça mostra uma pílula de estado lida do save: **Em uso**, **Comprada**, **Original**, preço (riscado
sem saldo) ou 🔒 com a noite que a libera. Regras de build continuam valendo: com o turbo instalado, a embreagem
original sozinha é recusada.

O `BuildResolver` é puro e determinístico: a ordem de instalação não importa, peças repetidas são ignoradas, só
cabe uma peça por categoria, o carro base nunca é alterado e o resultado é congelado e guardado em cache pela
chave do build (`BUILD_RESOLVER_VERSION` = 1). A oficina mostra antes/depois (potência, torque, faixa útil,
embreagem, aderência, relação) e 0–100 km/h e 402 m **simulados** e rotulados como estimativa. Cada valor que
muda ganha um marcador: **▲ verde** quando melhora (mais potência, torque, faixa, embreagem ou aderência; menos
tempo), **▼ vermelho** quando piora e **◆ cinza** na relação final, que só muda.

**Toda peça ganha.** Cada peça, instalada sozinha (ou sobre o mínimo que ela exige, como o kit turbo para a
turbina), deixa o carro mais rápido nos 402 m ou aumenta a potência ou a capacidade da embreagem sem perder
tempo, em todos os carros em que cabe. O ganho é sempre físico:

- **Escape, admissão, ignição, combustível e internos:** menos perda de carga, combustão mais rápida e menos atrito.
- **Wastegates:** seguram a pressão no alto giro.
- **Turbinas maiores:** aliviam a contrapressão.
- **Diferencial e câmbio:** a relação é escolhida pela oficina para o carro, com uma estimativa de 402 m, e as
  engrenagens novas perdem menos.
- **Pneus:** são dimensionados para aderir mais que o original já frios na largada.

Os textos de vitrine e de "Efeito físico" são diferentes. O efeito físico das peças do catálogo ampliado é gerado
dos próprios números aplicados pelo resolvedor (`describeMods`).

### Carros modernos (Capítulo 2): peças por família e liberação progressiva

Cada peça declara onde cabe (`compat`): família de motor, alimentação (aspirado/turbo), câmbio, tração e,
para motores futuros (seis contrapostos, V8, V12), a arquitetura do motor (`layouts`). Um carro mais caro pode
ter peças só dele: basta cadastrar a família e as peças, sem mexer no resolvedor.

- **Peças do carro, não do motor clássico:** alívio de peso, radiador, óleo, ventoinha, largura e pressão de
  pneu também servem nos carros modernos (`GENERIC_V2_CATEGORIES`). Comandos, coletores, kits turbo e o
  resto do catálogo clássico continuam só nos motores clássicos.
- **Liberação ao longo do capítulo:** nos carros modernos, essas peças pedem um desbloqueio a mais
  (`modernUnlock`):
  - largura e pressão de pneu na etapa 2;
  - peso e arrefecimento na etapa 5;
  - os níveis de competição só no Capítulo 3.
- **Stage 2 do turbo de fábrica (etapa 8):**
  - **peças:** downpipe sem catalisador (contrapressão ≈ 4 kPa), admissão direta
    turbo e Remap Stage 2;
  - **mapa:** +0,55 bar, com solenoide que segura até +0,7 bar, e torque no máximo 28 % acima do original
    em cada rotação;
  - **requisitos:** o mapa exige o downpipe e o intercooler maior. Acima de 85 % do limite dos internos de
    fábrica, exige pistões e bielas forjados, e o câmbio precisa aguentar o torque (embreagem reforçada nos
    manuais; os automáticos e DSG de fábrica já seguram o Stage 2);
  - **resultado:** +28 % de potência em todos os turbo de fábrica (320i: 184 → 235 cv).
- **Stage 3** (mapa para a turbina híbrida e motor forjado) já está cadastrado e aparece como "Capítulo 3".

O relatório completo, com todas as peças em todos os carros, sai com `npx tsx scripts/parts-gain-report.ts`. O
teste `tests/unit/career/parts-gain.test.ts` confere uma amostra.

## Economia e progressão

- Começo: 4.500 CR para comprar o primeiro carro — Uno Mille 1995 (800 CR), Chevette SL 1988 (1.400 CR)
  ou Gol GTS 1988 (2.200 CR). O resto vai para a oficina.
- Primeira vitória de uma noite: prêmio completo e a reputação da noite, uma única vez (`<evento>:first`).
- Revanche vencida: 35 % do prêmio e 1 de reputação, até 5 vezes por noite.
- Derrota: 10 % do prêmio, no máximo 100 CR. Queima de largada ou DNF: nada.
- Reputação limitada a 250 no capítulo; créditos nunca negativos.
- Cada tentativa tem `attemptId`: registrar a mesma tentativa de novo (clique duplo, recarga) não paga outra vez.
- Os classificados vendem os três carros iniciais. As peças ficam com o carro para o qual foram compradas.

| noite | rival | carro do rival | distância | prêmio | reputação | libera |
|---|---|---|---|---:|---:|---|
| 1. Primeira Noite | Lara "Faísca" | Celta 1.0 2003 original | 201 m | 300 | 10 | oficina, filtro, escape |
| 2. O Pequeno Valente | Eduardo "Duda Mille" | Uno Mille 1995 original | 201 m | 400 | 15 | coletor, pneus esportivos |
| 3. Acerto de Contas | Roberto "Beto Relógio" | Corsa GL 1996 (filtro, escape) | 201 m | 600 | 20 | comando, transmissão |
| 4. Tração Traseira | Fernando "Nando" | Chevette 1988 (filtro, escape, coletor, pneus) | 402 m | 800 | 25 | embreagem, diferencial, kit turbo, preparadores |
| 5. Respeita o AP | Leonardo "Léo AP" | Gol GTS 1988 (filtro, escape, pneus) | 402 m | 1.000 | 30 | pneus semi-slick |
| 6. O Aspirado | Paula "Giro" | Kadett SL 1992 (aspirado completo) | 402 m | 1.300 | 40 | desafio final |
| 7. Rei da Madrugada | Marcos | Saveiro GL 1994 turbo (`saveiro-marcos-chapter1`) | 402 m | 2.500 | 60 | — |

A dificuldade de um rival vem só do carro, das peças (resolvidas pelo mesmo `BuildResolver`) e do piloto: tempo de
reação, controle do acelerador na largada, pontos de troca. A IA nunca recebe torque, aderência ou velocidade que a
física não produziu.

## Salvamento

- IndexedDB versão 3: a migração cria o store `career` (chave `slotId`) e preserva presets, recordes e corridas.
- Um documento por slot; cada operação é uma transação com leitura e escrita juntas e contador de revisão. Se
  outra aba gravou antes, a operação falha com mensagem e nada é cobrado.
- Duas abas na mesma campanha: a segunda abre só para leitura (aviso na tela).
- Sem IndexedDB (fallback em memória), a tela avisa que nada será salvo.
- Exportar/importar: JSON com `format: "drag-physics-sandbox-2d/career"`. A importação valida o schema, os builds e
  os eventos antes de substituir o save.

- Formato do save: versão 3. A migração v2 → v3 só muda o número da versão: os novos ajustes do Dyno Lab são
  opcionais e um save antigo mantém o boost salvo.

## Dyno Lab 3.0 e motor quebrado

- **Ajustes** (`BuildTune`): pressão do turbo, corte de giro, giro de largada, resposta do acelerador
  (suave/padrão/agressiva), relação final (curta/padrão/longa), giro de troca automática (AT/DCT) e pressão dos pneus.
  Cada controle só abre com a peça real instalada (`TuningCapabilities.ts`); um controle travado mostra o motivo,
  por exemplo "Exige kit turbo compatível." em motor aspirado. Instalar ou remover peça revalida o ajuste salvo: o
  que deixou de valer é removido, com aviso.
- **Peças novas** (só onde faltavam): molas de válvula reforçadas (+400 rpm de giro seguro) e controle de largada
  (giro de largada em manual/DCT). Os forjados existentes também elevam o limite.
- **Tela**: abas Motor/Arrancada/Transmissão. Editar não reconstrói a tela nem grava o save: o rascunho (B) é medido
  após uma pausa curta (cache limitado, medições antigas descartadas) e comparado ao build salvo (A) na curva e em
  0–100 km/h, 201 m, 402 m, maior velocidade no teste (o ensaio tem duração limitada: não é a velocidade máxima
  estabilizada) e patinagem, todos medidos na física real. **Aplicar** grava; **Descartar** volta ao salvo.
- **Confiabilidade**: painel "CONFIABILIDADE DA PREPARAÇÃO" (Seguro/Esportivo/Agressivo/Crítico) com corte original,
  corte configurado, giro recomendado e limite mecânico; acima da faixa recomendada aparece o aviso de risco. O
  painel mostra a troca recomendada por marcha (curva de torque medida × relações: o giro em que a marcha seguinte
  puxa pelo menos o mesmo), também marcada no gráfico. Sem previsão de "segundos até quebrar": depende da condução.
  Limites por família de motor: [ENGINE_LIMITS.md](ENGINE_LIMITS.md).
- **Falha**: acima do giro recomendado (lido filtrado, 250 ms) o risco acumula, determinístico; as quedas do
  limitador não contam como descanso: o risco só recua depois de 0,5 s abaixo da faixa. Ao chegar a 100 % o motor
  quebra: sem combustão, sem religar, som de quebra e fumaça leve no capô. O carro perde a tração e desacelera
  livre por 1,25 s (arrasto e rolagem) antes da frenagem de segurança. A corrida vira DNF `engine-blown` (também
  antes do verde), o rival termina, o resultado mostra o giro exato da falha, é salvo uma vez, sem custo de reparo
  nem desgaste, e a próxima tentativa começa com o motor inteiro (o acerto continua salvo).
- **HUD**: barra "RISCO DE QUEBRA" (risco acumulado com filtro visual de 250 ms independente do FPS; faixas com
  histerese: Atenção 15/10 %, Alto risco 45/40 %, Crítico 75/70 %), aviso separado "RPM EXCESSIVO" e, com risco alto,
  "TROQUE DE MARCHA!" (ou "REDUZA O GIRO!" em neutro/última marcha). Um bipe curto ao entrar em Crítico, no máximo
  a cada 4 s. Cor + texto/símbolo, sem °C; respeita movimento reduzido.
- **Sandbox**: "Falhas mecânicas" vem desligado; na campanha está sempre ligado (só no carro do jogador). No
  Sandbox o giro seguro vem do corte do carro de catálogo: subir o corte no editor não aumenta a resistência (subir
  o limite mecânico, sim). Reiniciar (R) devolve o motor inteiro e mantém as falhas ligadas.

## Diálogos e retratos

Cenas como dados (`CareerStory.ts`), com avanço manual e botão "Pular". Uma cena vista entra em
`seenStorySceneIds` e não volta. Retratos dos oito personagens (Nina, Lara, Eduardo, Roberto, Fernando, Leonardo,
Paula, Marcos) são SVG procedurais originais com volume (luz principal de poste à esquerda, luz de recorte fria à
direita), sem fotos nem arte de terceiros.

## Testes

- `tests/unit/vehicles/*` — cada carro: fontes, geometria, curva pelos pontos documentados, picos no dinamômetro,
  0–100 e velocidade máxima dentro das tolerâncias, arte.
- `tests/unit/career/tuning.test.ts` — peças e resolvedor (ordem, idempotência, remoção, troca, peças
  incompatíveis, turbo, embreagem, diferencial, pneus, dinamômetro igual à curva).
- `tests/unit/career/career.test.ts` — economia, idempotência, transações, conflito entre abas, migração do banco,
  exportar/importar, história e comentários da Nina.
- `tests/e2e/career.spec.ts` — fluxo completo no navegador com capturas em `visual-captures/career/`.
- `scripts/balance-career.ts` — matriz e campanha simulada; o resultado está em [career-balance.md](career-balance.md).
