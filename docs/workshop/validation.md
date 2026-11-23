# Validação da expansão da oficina

| Verificação | Resultado |
|---|---|
| Cobertura por veículo | 25 carros, 27 rivais e três níveis em cada categoria aplicável |
| Ganho por peça | 2.836 combinações compatíveis com ganho no contexto medido |
| Progressão entre níveis | 830 séries, 2.490 comparações adjacentes aprovadas e medição de 100–200 km/h quando alcançada |
| Progressão e economia | 27 vitórias da história, 146 corridas livres e os três capítulos concluídos na rota simulada |

Os resultados por veículo e por montagem estão na [matriz de cobertura](parts-coverage.md), no [relatório de estágios](parts-stage.md) e no [relatório de economia](parts-economy.md). Cada relatório tem um JSON com os dados brutos. A [calibração](calibration.md) descreve as hipóteses físicas e as medidas usadas.

## Regressões verificadas

- Os saves antigos mantêm IDs e peças. Os veículos dos capítulos Liga e Elite usam o resolver moderno ao serem adquiridos e ao abrir saves anteriores.
- O teste E2E da oficina percorre catálogo, estados bloqueados, compra e substituição do Stage 1 ao Stage 3, débito único, reinstalação original, saldo e estoque persistidos. O cenário móvel verifica o acesso às categorias em uma coluna.
- No Lexus IS 350, o kickdown passa a reconhecer a aplicação gradual do acelerador. A relação final genérica e a suspensão traseira legada foram comparadas com os mesmos pneus esportivos nos dois builds. Os resultados com pneus originais estão no [relatório da transmissão](modern-driveline.md).
- Os testes de áudio verificam as configurações de fábrica e a síntese procedural dos carros preparados. A expansão preserva as configurações acústicas por veículo e usa os novos parâmetros de admissão, escape, turbo e rotação.

## Limites das medições

O intervalo de 100–200 km/h fica vazio quando a configuração não alcança 200 km/h nos 45 segundos simulados. Os tempos usam um piloto avançado e uma pista de referência. Peças de suporte podem melhorar temperatura, fluxo ou capacidade mesmo quando o tempo aumenta ligeiramente na referência.

A rota de economia usa a física das corridas e o controlador da campanha em memória. Ela demonstra que os três capítulos são alcançáveis com as compras e recompensas do quadro de eventos livres persistente. As 146 provas livres refletem essa estratégia de compra e esse piloto. A execução não estima o mínimo de corridas necessário para terminar.
