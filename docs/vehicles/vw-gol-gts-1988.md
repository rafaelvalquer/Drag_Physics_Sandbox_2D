# Volkswagen Gol GTS 1988 — AP 1.8S Original

Primeiro carro real do jogo: o Gol "quadrado" GTS de 1988, com motor AP 1.8S a etanol, câmbio de 5 marchas e tração dianteira, exatamente como saiu de fábrica. Ele usa a mesma física, o mesmo dinamômetro, a mesma IA, o mesmo sintetizador e o mesmo gerador de arte dos carros fictícios. Nada foi duplicado e nenhum número de desempenho é imposto.

| Item | Identificador | Onde está |
|---|---|---|
| Carro | `vw-gol-gts-1988` | [src/data/cars/vwGolGts1988.ts](../../src/data/cars/vwGolGts1988.ts) (`CAR_VW_GOL_GTS_1988`) |
| Motor | `vw-ap-18s-1988-ethanol` | [src/data/engines/vwAp18s1988.ts](../../src/data/engines/vwAp18s1988.ts) (`ENGINE_VW_AP18S_1988`) |
| Câmbio | `vw-gol-gts-1988-5mt` | constante `VW_GOL_GTS_1988_5MT` (o esquema de câmbio não tem campo de id) |
| Preset acústico | `vw-ap18s-stock-exhaust` | constantes `VW_AP18S_STOCK_EXHAUST` (escapamento) e `VW_AP18S_STOCK_ACOUSTIC` (balanço dos canais) |
| Desenho | `golGts88` | [src/game/vehicles/art/designs.ts](../../src/game/vehicles/art/designs.ts) |
| Teste de aceitação | — | [tests/unit/vehicles/vw-gol-gts-1988.test.ts](../../tests/unit/vehicles/vw-gol-gts-1988.test.ts) |

Os dados foram escritos em TypeScript tipado, como os outros carros, em vez dos JSON sugeridos. Assim o zod valida o carro na carga, e o tipo `CarConfig` impede campos esquecidos.

Na garagem, no Sandbox, na corrida e no dinamômetro o carro aparece como **Volkswagen Gol GTS 1988 — AP 1.8S Original**.

## Fontes e classificação dos dados

Cada valor usado pela simulação tem uma procedência registrada em `GOL_GTS_1988_PROVENANCE`. Um teste garante que só leva a etiqueta "fábrica" o que confere com o manual.

| Etiqueta | Significado |
|---|---|
| **fábrica** | consta do *Manual do proprietário VW Gol GTS 1988*, pp. 47–51 (Características gerais) |
| **secundária** | imprensa da época ou fichas técnicas de entusiastas; não confirmado pelo manual |
| **derivada** | calculada a partir de dados de fábrica |
| **estimada** | valor de engenharia plausível, sem documentação para este carro |
| **calibrada** | ajustada para a simulação reproduzir o comportamento documentado |

## Dados de fábrica (manual, pp. 47–51)

| Grandeza | Valor |
|---|---|
| Motor | 4 cilindros em linha, dianteiro longitudinal, comando no cabeçote por correia dentada |
| Cilindrada | 1781 cm³ (81,0 × 86,4 mm) |
| Taxa de compressão | 12,3 : 1 (etanol hidratado) |
| Ordem de ignição | 1-3-4-2 |
| Potência | 73 kW (99 cv) a 5600 rpm, NBR 5484 · 71 kW (96 HP) SAE J1349 |
| Torque | 146 N·m a 3200 rpm, NBR 5484 · 106 lb·ft SAE J1349 |
| Alimentação | carburador de corpo duplo, 2 estágios progressivos |
| Ignição | distribuidor com ignição eletrônica transistorizada |
| Motor de partida | 0,95 kW |
| Relações | 1ª 3,45 · 2ª 1,94 · 3ª 1,29 · 4ª 0,97 · 5ª 0,80 · ré 3,17 |
| Diferencial | 4,11 |
| Tração | dianteira |
| Embreagem | monodisco a seco, mola membrana |
| Freios | disco na dianteira, tambor na traseira, circuito em diagonal |
| Direção | mecânica, sem assistência |
| Rodas | liga leve 6J × 14H2 |
| Pneus | Firestone S660 ou Pirelli P6 (a medida não consta do manual) |
| Dimensões | comprimento 3849 mm, largura 1601 mm, altura 1350 mm |
| Entre-eixos e bitolas | entre-eixos 2358 mm, bitola dianteira 1364 mm, traseira 1384 mm |
| Vão livre | 130 mm com carga máxima |
| Pesos | tara 930 kg, carga útil 390 kg, peso bruto 1320 kg, máximo por eixo 700 kg (diant.) / 620 kg (tras.) |
| Desempenho | 0–80 km/h 6,5 s · 0–100 km/h 9,7 s · 0–120 km/h 13,8 s · 0–400 m 17,0 s · 0–1000 m 31,8 s |
| Velocidade máxima | 180 km/h a 5588 rpm em 5ª |

## Dados secundários

| Grandeza | Valor | Uso |
|---|---|---|
| Pneus | 185/60 R14 | referência para a inércia da roda e para a arte; o raio usado é derivado (abaixo) |
| Cx | 0,43 | usado; coerente com 180 km/h e 99 cv |
| Área frontal | 1,87 m² | usada |
| Carburador | Brosol 2E | representado por uma borboleta equivalente com abertura progressiva |
| Comando | 49G, tuchos mecânicos | os eventos de válvula são estimados |
| Marcha lenta | 950–1060 rpm (AP a etanol) | 1000 rpm, dentro da faixa |

As fontes também divergem do manual em dois pontos, e em ambos o projeto segue o manual:

- **Torque:** algumas fontes citam 14,9 kgfm a 3600 rpm. O manual de 1988 informa 146 N·m a 3200 rpm, que é o valor usado.
- **0–100 km/h:** testes de imprensa da época mediram 10,8–11 s. O manual declara 9,7 s, e a meta de calibração é 9,7 s.

## Valores derivados

| Valor | Como |
|---|---|
| Raio dinâmico do pneu 0,281 m | da velocidade máxima de fábrica: r = 50 m/s ÷ (5588 rpm ÷ (0,80 × 4,11) × 2π/60). O 185/60 R14 nominal teria 0,289 m; a diferença é o achatamento sob carga |
| Massa em operação 1027 kg | tara 930 kg (fábrica) + motorista 75 kg (estimado) + 22 kg de etanol, ≈ ½ tanque (estimado). As três parcelas ficam separadas em `GOL_GTS_1988_MASS` |
| Ângulos de ignição | 0°, 180°, 360° e 540° na ordem 1-3-4-2 |
| Partida | 38 N·m a 250 rpm ≈ 0,99 kW, próximo dos 0,95 kW do motor de partida |
| Altura do assoalho 0,15 m | 130 mm com carga máxima (fábrica) → ≈ 150 mm com o carro vazio |

## Curva de torque

A curva passa **exatamente** pelos dois pontos documentados. Os outros pontos são calibrados para dar uma forma típica do AP 1.8S a carburador. A curva sobe até um platô entre 3000 e 4000 rpm, e a potência máxima fica em 5600 rpm.

| rpm | N·m | cv | Procedência |
|---|---|---|---|
| 500 | 82,0 | 5,8 | calibrada |
| 1000 | 110,0 | 15,7 | calibrada |
| 1500 | 123,0 | 26,3 | calibrada |
| 2000 | 133,0 | 37,9 | calibrada |
| 2500 | 141,0 | 50,2 | calibrada |
| **3200** | **146,0** | 66,5 | **fábrica (torque máximo)** |
| 3800 | 145,0 | 78,5 | calibrada |
| 4400 | 141,2 | 88,5 | calibrada |
| 5000 | 134,1 | 95,5 | calibrada |
| **5600** | 124,2 | **99,0** | **fábrica (potência máxima)** |
| 6000 | 113,4 | 96,9 | calibrada |
| 6500 | 101,5 | 93,9 | calibrada |
| 7000 | 86,0 | 85,7 | calibrada (só para cobrir o limite da simulação) |

**Medido no dinamômetro do jogo** (o torque é medido pelo freio da bancada, não lido da curva):

- 146,0 N·m a 3200 rpm;
- 99,0 cv a 5600 rpm;
- pico de potência em ≈ 5610 rpm;
- marcha lenta estável em ≈ 1000 rpm.

## Limite de rotação

O manual não documenta corte eletrônico de rotação, e o AP 1.8S de 1988 tem carburador e distribuidor. Os valores abaixo são **limites de proteção da simulação** e não devem ser lidos como dados do carro original:

| Valor | rpm | Procedência |
|---|---|---|
| Faixa vermelha (luzes de troca, conta-giros) | 6200 | estimada |
| Limite da simulação (`revLimitRpm`) | 6500 | calibrada |
| Proteção contra sobregiro na redução (`maxSafeRpm`) | 6800 | calibrada |

## Calibração de desempenho

O teste de aceleração ([src/game/race/accelerationTest.ts](../../src/game/race/accelerationTest.ts)) é feito como numa medição de fábrica:

- motor ligado, 1ª engatada;
- plena carga, com a IA avançada escolhendo os pontos de troca;
- relógio a partir do primeiro movimento do carro.

A IA só escreve os comandos que o jogador tem (acelerador, subir e descer marcha). Os tempos saem da física: nada altera cronômetro, posição ou velocidade.

```bash
npm run calibrate:vehicle
```

Resultado na Test Track (24 °C, 101,3 kPa):

| Teste | Simulado | Manual | Desvio |
|---|---|---|---|
| 0–80 km/h | 6,66 s | 6,5 s | +2,5 % |
| 0–100 km/h | 9,90 s | 9,7 s | +2,0 % |
| 0–120 km/h | 13,85 s | 13,8 s | +0,3 % |
| 0–400 m | 17,14 s | 17,0 s | +0,8 % |
| 0–1000 m | 31,64 s | 31,8 s | −0,5 % |
| Velocidade máxima | 180,3 km/h, em 5ª | 180 km/h | +0,2 % |
| Rotação na velocidade máxima | 5667 rpm | 5588 rpm | +1,4 % (deslizamento do pneu) |

Na mesma passada:

- **Trocas:** a ≈ 6300 rpm, perto do limite. Na curva do AP, cada marcha puxa mais que a seguinte até ali.
- **Carga no eixo motriz:** 61 % parado e 51–63 % durante a arrancada. A tração dianteira perde carga ao acelerar, o que limita a largada.

### Parâmetros ajustados na calibração

| Parâmetro | Valor | Por quê |
|---|---|---|
| `tires.muPeak` | 1,05 | radial de rua da época, pista seca e aquecida; limita a largada da tração dianteira |
| `frontWeightFraction` | 0,61 | motor à frente do eixo dianteiro, motorista a bordo. Não são as cargas máximas por eixo do manual (700/620 kg) |
| `transmission.efficiency` | 0,93 | transeixo longitudinal com engrenagens helicoidais |
| Fases de troca | ≈ 0,30 s por troca | ajuda de condução do câmbio semiautomático do jogo, não característica do carro |
| Embreagem automática | acoplamento 4,5/s, largada a 3400 rpm, anti-stall a 1050 rpm | idem: o carro real tem pedal de embreagem |

Uma varredura de parâmetros mostrou que os ajustes da embreagem automática pouco mudam os tempos. Os que importam são a aderência, o tempo de troca e a eficiência.

## Som

O motor é sintetizado pelo mesmo modelo acústico dos outros carros, a partir do estado da física:

- **ignição:** 4 cilindros em linha, ordem 1-3-4-2 a cada 180°, logo a frequência de ignição é rpm × 4 / 120;
- **escapamento:** sistema original simples (coletor 4 em 1, tubo, dois silenciosos) com ronco de admissão do carburador de corpo duplo;
- **trem de válvulas:** tuchos mecânicos audíveis;
- **sem turbo:** não há turbo nem válvula de alívio, e o canal turbo fica em silêncio.

As medidas do escapamento (comprimentos, diâmetros, câmaras, absorção) e o balanço dos canais **não são medições oficiais**. Foram calibradas de ouvido e em comparação com os outros presets. A ponteira de 48 mm foi escolhida para que o ruído turbulento do jato não encubra os pulsos de escape.

**Não há gravações do carro real no projeto.** O som é plausível para um AP 1.8 aspirado de escapamento original, mas **não se afirma identidade acústica** com o Gol GTS. Validá-la exigiria gravações de referência (marcha lenta, aceleração livre, passada em plena carga) e uma comparação espectral.

## Arte

O desenho `golGts88` é original, feito em código como os demais. Nenhuma foto foi copiada ou redistribuída. As proporções vêm das dimensões do manual, e os detalhes de estilo seguem descrições do modelo.

**Carroceria:**

- silhueta do Gol "quadrado" de duas portas, com traseira hatch inclinada;
- para-choques envolventes e molduras laterais escuras do GTS, com friso fino na cor de destaque;
- emblema "GTS" na moldura lateral;
- aerofólio discreto no topo da tampa traseira;
- lanternas traseiras com nervuras e pisca dianteiro âmbar.

**Rodas e freios:**

- rodas de 14" em estilo "Pingo d'Água", com 10 furos em gota e 4 parafusos;
- disco sólido na frente e tambor atrás, em camadas de cubo separadas (`hub` e `hubRear`).

**Fidelidade e limites:**

- **Rodas:** giram em pivôs próprios com o ângulo integrado da velocidade física de cada eixo, não da rotação do motor. A roda motriz dianteira pode patinar enquanto a traseira acompanha o chão.
- **Marca:** o logotipo da Volkswagen **não** é desenhado.
- **Grade e faróis:** a vista é lateral, então a grade e os faróis retangulares aparecem só como o recorte do perfil.

## Fora do escopo (conforme o pedido)

O projeto não inclui:

- comando de embreagem manual (o câmbio continua semiautomático, só W/E/Q);
- corte de giro apresentado como original;
- AP 2.0, turbo, comandos ou catálogo de preparação;
- telas exclusivas do Gol.

## Parâmetros que ainda dependem de calibração

São valores estimados ou calibrados que dados reais poderiam substituir:

1. **Pontos intermediários da curva de torque.** Exigem uma curva de dinamômetro de um AP 1.8S de 1988 original.
2. **Faixa vermelha e limite da simulação.** Exigem a marcação do conta-giros original e o comportamento real do motor acima de 6000 rpm.
3. **Pneus.** A aderência e a forma da curva (μ, B, C, E) foram calibradas pelos tempos do manual. A inércia da roda é estimada.
4. **Distribuição de peso e altura do CG.** As cargas por eixo do carro em ordem de marcha não constam do manual.
5. **Massa em operação.** O manual não diz se a tara inclui combustível; motorista e combustível são estimados.
6. **Eficiência do transeixo e inércias do trem de força.**
7. **Escapamento e balanço acústico.** Exigem medições de geometria e gravações de referência.
8. **Marcha lenta.** O controlador de ar de marcha lenta do modelo substitui o parafuso de marcha lenta e o afogador automático do carburador.
9. **Comportamento do carburador.** É modelado como uma borboleta equivalente com abertura progressiva; não há modelagem de cuba, giclês nem enriquecimento.

## Testes de aceitação

`tests/unit/vehicles/vw-gol-gts-1988.test.ts`:

1. **Listas:** o carro está nas listas da garagem, do Sandbox, da corrida e do dinamômetro, com nome e ids corretos, e passa na validação.
2. **Dimensões e massa:** são as do manual, com tara, motorista e combustível separados.
3. **Sprite:** desenho próprio, rodas "Pingo d'Água" de 4 furos, tambores atrás, emblema GTS, sem logotipo.
4. **Motor:** AP 1.8S original, 1781 cm³, aspirado, sem turbo.
5. **Dinamômetro:** mede 146 N·m a 3200 rpm e 99 cv a 5600 rpm, com os picos onde o manual diz.
6. **Acelerador:** controla torque e rotação; o limite da simulação segura o giro.
7. **Mesmo modelo:** dinamômetro e corrida usam o mesmo modelo de motor e a mesma curva.
8. **Câmbio:** cinco marchas com as relações de fábrica e diferencial 4,11.
9. **Trocas:** sobe e desce marcha só com W/E/Q, sem controle de embreagem.
10. **Tração e rodas:** tração dianteira, com o eixo motriz perdendo carga ao acelerar e a roda dianteira patinando. As rodas seguem a própria velocidade física, não a do motor.
11. **Ignição no som:** 4 cilindros, ordem 1-3-4-2 a cada 180°, frequência fundamental = rpm × 4 / 120.
12. **Turbo:** canal turbo em silêncio.
13. **Aceleração:** 0–80, 0–100, 0–120, 400 m e 1000 m a menos de 5 % do manual.
14. **Velocidade máxima:** 180 km/h em 5ª, perto de 5588 rpm, com trocas coerentes com a curva.
15. **Procedência:** o que é "fábrica" confere com o manual, e o que não está no manual nunca é "fábrica".

O carro também passa por todos os testes genéricos que percorrem os carros e motores:

- validação de esquema;
- geometria e ignição;
- partida e marcha lenta;
- curva medida e potência nominal;
- som a 44,1 e 48 kHz;
- arte e metadados visuais;
- escala do conta-giros e luzes de troca.
