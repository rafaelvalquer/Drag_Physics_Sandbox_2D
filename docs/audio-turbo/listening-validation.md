# Validação auditiva — Turbo Acoustics 2.0

> **Status: pendente.** Nenhuma afirmação de fidelidade acústica vale antes desta escuta. A aprovação
> final é do responsável pelo jogo.

## Preparação

- Fones fechados ou monitores de estúdio; volume fixo durante toda a sessão (ajustado uma vez no Gol
  turbo, fase de aceleração).
- Sandbox → **Turbo: comparação A/B (dev)**. "A" = modelo antigo, "B" = Turbo Acoustics 2.0. Os níveis
  médios foram igualados pelo nível A (ver [calibration-matrix.md](calibration-matrix.md)).
- Para cada carro: largada, aceleração até a 3ª, soltar o acelerador com pressão (tip-out), trocar marcha,
  rotação constante em carga parcial, desligar o motor.
- Se possível, ouvir sem saber qual é A e qual é B (outra pessoa troca o seletor).
- Os WAVs em `before/` e `after/` têm o mesmo trecho e o mesmo ganho para escuta fora do jogo.

## Referências de escuta

Usar só como referência de ouvido (não copiar, não incorporar ao jogo): vídeos e gravações públicas de
cada tipo de hardware — kit turbo AP com válvula atmosférica; turbo sem válvula (flutter); EA113/EA888
de fábrica (recirculada); N20/N55 twin-scroll; VR38DETT biturbo; conversão turbo em V6 aspirado.
Anotar a fonte (link, data) na coluna de observações.

## Critérios (0–10)

| # | Critério | O que ouvir |
|---|---|---|
| 1 | Rotor / assobio | tom acompanha o enchimento do turbo, sem degraus, cliques ou "chiado digital" |
| 2 | Fluxo de ar | "whoosh" cresce com carga e rotação; não é um chiado fixo |
| 3 | Válvula de alívio | soa no tip-out e nas trocas; atmosférica ≠ recirculada; sem válvula = silêncio da válvula |
| 4 | Flutter | só sem válvula (ou válvula fraca), curto, decai, não repete infinitamente |
| 5 | Wastegate | discreta na interna, audível na externa aberta |
| 6 | Identidade | carros diferentes soam diferentes; mesmo hardware soa igual |
| 7 | Biturbo | GT-R / C43 / Stinger: mais denso que um turbo, sem soar como "dois carros" |
| 8 | Mixagem | o turbo não encobre motor e escape; nível coerente com o hardware |
| 9 | Artefatos | sem estalos, aliasing, ruído digital em 44,1 kHz e em qualidade baixa |
| 10 | Multiplayer | adversário a 20 Hz: válvula ainda soa, sem saltos de tom |

## Ficha

| Carro / build | A ou B preferido | Rotor | Fluxo | Válvula | Flutter | Wastegate | Identidade | Biturbo | Mix | Artefatos | Observações |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Gol GTS AP — Turbo de teste | | | | | | | | — | | | |
| Saveiro GL — Marcos Turbo | | | | | | | | — | | | |
| Gol + kit forte sem válvula (lab `--bov=none`) | | | | | | | | — | | | |
| BMW 320i F30 (N20, twin-scroll) | | | | | | | | — | | | |
| Mitsubishi Evo X (4B11) | | | | | | | | — | | | |
| Honda Civic Si + conversão turbo | | | | | | | | — | | | |
| Nissan 370Z + conversão turbo (V6, um rotor) | | | | | | | | — | | | |
| Nissan GT-R R35 (biturbo) | | | | | | | | | | | |
| Mercedes-AMG C43 (biturbo) | | | | | | | | | | | |
| Vetra RS / Orion XR | | | | | | | | — | | | |

**Aprovação:** ☐ aprovado ☐ aprovado com ajustes ☐ reprovado — responsável: ____________ data: ________

Ajustes pedidos viram mudanças de perfil (`TurboAcousticProfiles.ts`) com nova rodada do
`scripts/audio-turbo-report.ts`; a física não é alterada para atingir um som.
