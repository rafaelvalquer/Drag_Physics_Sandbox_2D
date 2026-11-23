# Simulação de compra e progressão da oficina

Uma rota de referência com piloto avançado, Gol GTS inicial e os carros das finais disponíveis na garagem. As corridas foram simuladas com a física do jogo. O controlador da campanha gravou compras, vitórias, perdas e recompensas num save em memória.

A rota tenta o próximo evento principal ainda inédito. Após uma derrota, corre eventos livres de bairro para financiar peças. Na Liga, considera Golf, 320i e Evo. Na Elite, considera GT-R, Giulia e C43. As compras de carro reservam 6.000 CR para a oficina. A execução limita cada capítulo a 150 tentativas.

| Capítulo | Início CR | Final CR | Menor saldo CR | Peças CR | Carros CR | Vitórias da história | Derrotas da história | Livres ganhos / corridos | Prêmios dos livres CR | Carros usados | Concluído |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| chapter-1 | 2300 | 4020 | 20 | 10680 | 0 | 7 | 5 | 20 / 20 | 5000 | vw-gol-gts-1988 | Sim |
| chapter-2 | 4020 | 20290 | 40 | 80830 | 89000 | 10 | 23 | 93 / 101 | 102300 | vw-saveiro-gl-1994, vw-golf-gti-mk4-2003, bmw-320i-f30-2014, mitsubishi-evo-x-2012 | Sim |
| chapter-3 | 20290 | 180590 | 40 | 281600 | 295000 | 10 | 11 | 46 / 46 | 174800 | bmw-335i-f30-2013, mercedes-amg-c43-2017, alfa-giulia-qv-2017 | Sim |

Cada compra, o carro a que ela pertence e o valor efetivamente debitado constam no relatório JSON.
