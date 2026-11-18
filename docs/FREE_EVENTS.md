# Eventos livres procedurais — Campanha

Eventos independentes da história, disponíveis desde a primeira compra de carro. Acesse pela
tela principal, pelo menu da carreira ou pela aba **Eventos livres**.

## Geração e jogabilidade

- Três níveis por capítulo: **Racha de bairro** (201 m), **Preparado** (402 m) e
  **Elite** (402 m; 1.000 m no Capítulo 3).
- Os veículos são escolhidos **exclusivamente do catálogo do capítulo ativo**, com
  pintura, piloto e peças gerados por semente (não por bônus de potência).
- O adversário é resolvido pelo mesmo \`resolveBuild\` usado na Oficina. Instalação incompatível
  é rejeitada durante a geração; a potência exibida é a calculada.
- Pintura, carro e peças permanecem os mesmos entre prévia, largada e resultado.
  As ofertas mudam depois de uma disputa ou ao clicar em **Gerar novos adversários**.
- A habilidade da IA acompanha o nível, sem multiplicadores ocultos de aceleração.
- Capítulos e desbloqueios permanecem ligados **somente** aos eventos de campanha.

## Economia (CR por vitória)

| Capítulo | Bairro | Preparado | Elite |
| --- | ---: | ---: | ---: |
| 1 — Madrugada Zero | 250 | 500 | 750 |
| 2 — Liga da Madrugada | 1.100 | 2.100 | 3.400 |
| 3 — Elite da Madrugada | 3.800 | 6.900 | 11.000 |

Não há inscrição. Derrotas, queimadas de largada e DNFs não pagam.
Vitórias são repetíveis, mas cada tentativa só é registrada e paga uma vez.
Sete vitórias na Elite do Capítulo 1 geram 5.250 CR, suficientes para o kit turbo
de 4.000 CR e a embreagem de 900 CR, sem fazer a campanha avançar.

## Salvamento e segurança

\`CareerSave.freeEventRotation\` guarda a posição da rotação (valor padrão zero para
saves antigos); a oferta é reproduzível após recarregar. Concluir ou atualizar um
evento avança essa posição. O resultado fica em \`CareerSave.results\`, com ID começando
por \`free-<capítulo>-...\`, visível no Histórico.

\`CareerController.recordFreeRace\` recalcula a oferta pelo estado salvo,
valida o ID, a assinatura e o build do adversário, registra a recompensa em uma
transação atômica e avança a rotação. Uma tentativa repetida retorna o resultado
anterior, sem pagamento adicional. Os resultados livres não acionam histórias,
recompensas de chefes, progresso de capítulos ou reputação.

## Validação

\`\`\`bash
npm ci
npm run typecheck
npm test
npx playwright test tests/e2e/free-events.spec.ts
npm run build
\`\`\`

A matriz unitária cobre os três capítulos, geração determinística, builds físicos
válidos, alterações de oferta, persistência, vitórias repetidas, derrota e bloqueio
de tentativas duplicadas. O teste E2E percorre menu, ofertas, atualização, rival,
corrida, resultados e histórico.
