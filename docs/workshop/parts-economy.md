# Simulação de compra e progressão da oficina

Uma rota de referência com piloto avançado, Gol GTS inicial e os carros das finais disponíveis na garagem. As corridas foram simuladas com a física do jogo. O controlador da campanha gravou compras, vitórias, perdas e recompensas num save em memória.

A rota tenta o próximo evento principal ainda inédito. Após uma derrota, procura uma prova livre favorável entre as ofertas e os carros da garagem. Troca o adversário livre após perder. Na Liga, considera Golf, 320i e Evo. Na Elite, considera GT-R, Giulia e C43. As compras de carro reservam 6.000 CR para a oficina. A execução limita cada capítulo a 150 tentativas.

| Capítulo | Início CR | Final CR | Menor saldo CR | Peças CR | Carros CR | Vitórias da história | Derrotas da história | Livres ganhos / corridos | Prêmios dos livres CR | Carros usados | Concluído |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| chapter-1 | 2300 | 2890 | 20 | 10680 | 0 | 7 | 4 | 14 / 14 | 3970 | vw-gol-gts-1988 | Sim |
| chapter-2 | 2890 | 23960 | 0 | 88330 | 89000 | 10 | 25 | 102 / 113 | 114400 | vw-saveiro-gl-1994, vw-golf-gti-mk4-2003, bmw-320i-f30-2014, mitsubishi-evo-x-2012 | Sim |
| chapter-3 | 23960 | 175210 | 310 | 281600 | 295000 | 10 | 6 | 19 / 19 | 166250 | bmw-335i-f30-2013, mercedes-amg-c43-2017, alfa-giulia-qv-2017 | Sim |

Cada compra, o carro a que ela pertence e o valor efetivamente debitado constam no relatório JSON.
