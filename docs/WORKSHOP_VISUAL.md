# Oficina Visual 2.0

A oficina da campanha tem três áreas: **catálogo** (esquerda: abas, busca, filtros e peças), **o carro** (centro: arte real do jogo com os modos *Visual externo*, *Visão técnica* e *Detalhe da peça* e a comparação *Atual / Com a peça*) e **detalhes da peça** (direita). Nada na tela altera a física, os preços, os desbloqueios ou o save: a prévia é o próprio resolvedor.

## Arquitetura

```
src/ui/career/workshop-visual/
  WorkshopVisualController.ts   orquestra os componentes; toda compra/instalação/remoção vai ao CareerController
  WorkshopVisualScreen.ts       resumo do carro, navegação inferior, confirmação do conjunto
  WorkshopVisualState.ts        estado de UI (aba, busca, filtro, seleção, modo, versão); nunca vai ao save
  WorkshopPreviewModel.ts       prévia hipotética (withPart + BuildResolver/V2 + planInstall), pura
  WorkshopPartCatalog.ts        abas, grupos e cartões; filtro "Compatíveis" pergunta ao resolvedor
  WorkshopSearchFilters.ts      busca sem acento, sinônimos (turbina↔turbo) e filtros
  WorkshopPartInspector.ts      detalhes: o que faz, o que muda, o que falta, detalhes técnicos, ações
  WorkshopComparisonPanel.ts    antes/depois com números do resolvedor e estimativas de 201 m, 402 m e 1 km
  WorkshopVisualPreview.ts      o palco: dois canvases com a mesma câmera, desenho sob demanda
  WorkshopAnimationController.ts timelines GSAP (um gsap.context por visita)
  WorkshopCopy.ts               todos os textos (amigáveis + detalhe técnico original)
src/game/vehicles/art/parts/
  PartVisualRegistry.ts         como cada peça é MOSTRADA (sem preço, requisito ou física)
  PartVisualResolver.ts         ilustração por peça, mudanças externas reais, estado técnico do carro
  PartVisualAnchors.ts          âncoras em metros por arquitetura (motor dianteiro/central/traseiro, eixo tracionado)
  PartVisualComposer.ts         compõe a cena: átlas real do carro + camada técnica
  EngineDrawings.ts             motores por arquitetura e cilindros (em linha, V, boxer; V6 = 2 bancadas de 3)
  PartIllustrations.ts          ilustrações procedurais (rodas, pneus, escape, turbo e as demais famílias)
```

A transição da tela fica no `CareerTransitionManager.enterWorkshop()`: ele cria o `WorkshopAnimationController`, e o próximo `show()` (ou sair da oficina) o descarta e reverte todos os tweens.

## O que é real e o que é ilustração

* **Modificação externa só existe quando o carro resolvido muda por fora** (`visual.mods`: escrita do pneu, ponteira do escape, intercooler na frente). `externalChanges()` compara os dois carros resolvidos; peça interna nunca aparece como externa e nada é simulado.
* **Rodas (aros) são uma família reservada**: o catálogo ainda não tem peça de aro, então nenhuma foi inventada. O pneu muda a aparência real (escrita) e tem ilustração própria no modo detalhe.
* A **visão técnica é ilustrativa**: as posições seguem `CarConfig` (`drivenAxle`, `engine.cylinders/architecture/bankAngleDeg`, `turbo.layout`), `visual.engineMount` (opcional, novo) e os metadados reais da arte (saída do escape, entre-eixos, nariz e traseira).
* `visual.engineMount` é **opcional**: ausente = motor dianteiro (transversal em tração dianteira, longitudinal nos demais). Só o Evo X (transversal com tração integral) declara. Não afeta física, saves nem o resolvedor v1.
* Números (potência, força do motor, peso, aderência, resposta da turbina, tempos) vêm do resolvedor e da simulação; tempos são **estimativas** (piloto ideal, Avenida Norte) e rotulados assim.

## Testes e capturas

`tests/unit/vehicles/part-visual.test.ts`, `tests/unit/ui/workshop-visual.test.ts` e `tests/e2e/workshop-visual.spec.ts` (V01–V43). As capturas de homologação (Chevette SL 1988, Gol GTS 1988, BMW 320i F30 e Nissan 350Z) vão para `visual-captures/workshop/`.

## Como expandir os assets

Cada família nova entra em três lugares: uma linha em `CATEGORY_VISUAL`, um `case` em `PartIllustrations.drawPartAsset` e, se afetar a vista técnica, o desenho em `PartVisualComposer`. Uma peça de aro (roda) precisa de uma nova categoria no catálogo físico antes: o registro visual já reserva `wheel-original` e `wheel-sport`.
