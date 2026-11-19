# Transmissão e tração integral dos carros modernos

O veículo recebe as séries que correspondem ao hardware original. Na caixa manual, o catálogo tem embreagem, volante e engrenagens de relações intermediárias. A dupla embreagem recebe pacotes de discos e calibração de troca da TCU. O automático recebe elementos reforçados, travamento do conversor de maior capacidade e calibração das fases de troca. A relação final está disponível nas três transmissões. O acoplamento central é exclusivo da tração integral.

Cada série tem estágios 1, 2 e 3 que ocupam o mesmo slot. A capacidade aumenta a margem física para transmitir torque e as mudanças de inércia, eficiência, engrenagens e tempo de troca entram na simulação. O Dyno Lab permite configurar a largada com os novos pacotes de dupla embreagem. Os conversores novos mantêm seu fator K original, de modo que o estol continua coerente com a configuração de fábrica.

Os efeitos e custos são estimativas calibradas para o jogo. No Lexus 2GR-FSE e no Alfa 690T, o salto inicial de eficiência mudava a trajetória da transmissão na largada. A varredura em incrementos de 0,001 permitiu escolher faixas progressivas com perdas menores em cada família. O comparador da oficina mostra capacidade da caixa, fase de torque, travamento do conversor e acoplamento AWD quando esses parâmetros mudam.

Para reproduzir esta rodada da calibração:

```sh
npx tsx scripts/parts-stage-report.ts '--groups=modern-clutch,modern-manual-gearset,modern-flywheel,modern-dual-clutch,modern-automatic,modern-final-drive,modern-awd-coupling' --fail
```

A execução integral sem filtros continua necessária para validar o conjunto da oficina.

Resultado desta rodada: 55 séries aplicáveis, 165 comparações adjacentes e nenhuma reprovação no recorte de transmissão. A suíte verificou as configurações individuais dos 18 carros modernos. O cenário de navegador passou com as medidas de capacidade, duração da fase de torque e travamento do conversor exibidas na oficina.
