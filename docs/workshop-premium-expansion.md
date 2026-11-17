# Oficina Premium — expansão técnica (branch `feature/workshop-premium-expansion`)

## Visão geral
A oficina da campanha passa a expor **nove sistemas**. Cada sistema possui **slots independentes** (subcategorias) com peça original gratuita, peça instalada, estoque, disponibilidade, bloqueio e selo de novidade. Um slot aceita uma peça por vez; a substituída vai para o inventário do veículo sem perda de propriedade.

Os nove sistemas são Motor, Admissão, Escape, Transmissão, Pneus, Turbo, Eletrônica, Arrefecimento e Estrutura. A aba da oficina preserva os mesmos hooks de navegação, compra, instalação, restauração, comparativo e dinamômetro.

## Organização dos arquivos

- `src/game/career/tuning/parts.ts`: tipos, catálogo legado, tabs, slots e metadados de UI.
- `src/game/career/tuning/expandedParts.ts`: opções novas por categoria e estágio, preço, desbloqueio e parâmetros mecânicos.
- `src/game/career/tuning/BuildResolver.ts`: normalização da lista instalada, validação, síntese dos parâmetros e propagação ao carro.
- `src/game/career/tuning/breathingModel.ts`: balanço de carga, vazão, contrapressão, eficiência termodinâmica, turbo e curva de torque.
- `src/game/career/CareerProgression.ts`: desbloqueio por noite, com capítulos 2 e 3 explicitamente bloqueados.
- `src/game/career/CareerController.ts`: persistência transacional de compra, troca, remoção e boost.
- `src/modes/CareerMode.ts` + `src/ui/career/career.css`: experiência visual agrupada e responsiva.

## Mecânica e limites

| Conjunto | Variáveis no motor/simulação |
| --- | --- |
| Filtro / caixa de ar | Queda de pressão no escoamento, volume da caixa |
| Coletor / borboleta | Comprimento e diâmetro dos dutos, ressonância, área da borboleta, tempo de resposta |
| Comando / cabeçote / taxa | Eventos de válvulas, levantamento, fluxo em alta, rendimento termodinâmico e limite de detonação |
| Volante / internos | Inércia rotacional e limite mecânico de torque (sem potência grátis) |
| Escape | Contrapressão quadrática com vazão, diâmetro, absorção acústica |
| Câmbio / relação / embreagem | Relações de marcha, torque suportado e velocidade de engate |
| Pneu | Coeficiente de atrito, rigidez, massa rotativa e sensibilidade à temperatura |
| Turbo / turbina / intercooler / wastegate | Pressão e fluxo de ar, spool, temperatura de carga, janela de ajuste |
| ECU / combustível / ignição | Combustão e atraso de ignição, limites de alimentação com maior pressão |
| Arrefecimento | Aproximação de perdas mecânicas e tolerância à detonação em uso sustentado |
| Estrutura | Massa e posição do centro de gravidade |

**Modelo:** aproximação fisicamente orientada para o jogo. Não substitui ensaio real em dinamômetro, medições de vazão ou cálculo térmico detalhado de radiador/óleo. Peças de arrefecimento usam coeficientes reduzidos de perdas como aproximação até existir um modelo térmico dinâmico. Itens de resistência alteram limites de integridade, sem adicionar torque.

### Compatibilidade
- Uma peça por slot; nenhuma compra silencia conflitos.
- Componentes avulsos de turbo exigem um kit instalado.
- Pressão configurada deve estar no limite da wastegate e do kit.
- Turbo exige taxa compatível, embreagem com margem de torque, alimentação e limite mecânico dos internos.
- Transmissão, pneus e estrutura não recalculam artificialmente a curva de torque da fábrica.
- Resultado inválido é recusado, sem debitar créditos nem gravar alterações parciais.

## Progressão
- **Capítulo 1:** mantém todas as peças e desbloqueios existentes, adicionando ajustes de fluxo, escape, volante, pneus e estrutura acessíveis conforme as noites.
- **Capítulo 2:** catálogo preparado, bloqueado enquanto a campanha não introduzir a progressão do segundo capítulo.
- **Capítulo 3:** catálogo extremo, bloqueado enquanto a campanha não introduzir a progressão do terceiro capítulo.

Os estágios exibidos são descritivos do tipo de build (original, rua, aspirado ou turbo), **não** são uma garantia de potência. Metas de calibração do Gol AP: original ~112–116 cv; estágio 1 120–132 cv; aspirado 135–165 cv; turbo básico 160–180 cv; turbo street 185–220 cv; turbo preparado 220–280 cv; extremo 280–350+ cv. Os valores posteriores ao capítulo 1 são metas de calibração futura, não faixas validadas em todas as combinações.

## Validação e aceite

Comandos de CI: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. Para validação visual local: `npm run dev` e `npm run test:e2e` com browsers Playwright instalados.

Cenários de regressão: preservação de preços/IDs legados; compra e trocas atômicas; restauração de fábrica; desbloqueios de campanha; dinamômetro; potência e spool; transmissão, pneus e massa independentes; interface em desktop/tablet/mobile.

### Pendências para expansão completa
1. Criar narrativa, eventos, créditos e reputação próprios dos capítulos 2 e 3 (não incluídos nesta mudança).
2. Calibrar todas as combinações de preparação com um banco de dyno físico, especialmente potências acima de 180 cv.
3. Adicionar modelo térmico transiente de água e óleo e limites de durabilidade para sessões consecutivas.
4. Executar testes E2E Playwright e inspeção visual nos navegadores/dispositivos-alvo.
