# Eventos Livres

Abra **Eventos Livres** na Campanha para disputar corridas gratuitas e ganhar créditos. O quadro mostra três desafios. Use os filtros para escolher a classe e encontrar provas de 201 m e 402 m. No Capítulo 3, há também provas de 1.000 m no Hangar Executivo e no Pier Elite.

## Classes e premiação

Iniciante fica disponível assim que o capítulo abre. As demais classes seguem a campanha.

| Capítulo | Rua | Preparado | Competição |
| --- | ---: | ---: | ---: |
| 1 · Madrugada Zero | Noite 2 | Noite 4 | Noite 6 |
| 2 · Liga da Madrugada | Etapa 2 | Etapa 4 | Etapa 8 |
| 3 · Elite da Madrugada | Duelo 2 | Duelo 4 | Duelo 5 |

| Prêmio em 402 m | Capítulo 1 | Capítulo 2 | Capítulo 3 |
| --- | ---: | ---: | ---: |
| Iniciante | 250 CR | 1.200 CR | 5.000 CR |
| Rua | 400 CR | 2.200 CR | 9.000 CR |
| Preparado | 650 CR | 3.800 CR | 15.000 CR |
| Competição | 850 CR | 5.500 CR | 25.000 CR |

A prova de 201 m paga 80% do valor-base. A de 1.000 m paga 125%. O prêmio é arredondado à dezena na geração da oferta. Só a vitória paga. A história continua sendo a fonte de reputação, desbloqueios e carros recebidos como prêmio.

## Quadro e revanche

As ofertas ficam no save junto com semente, carro, configuração de oficina, pintura, pista, perfil do piloto e prêmio. Uma vitória libera o espaço para um novo rival. Derrota, queima ou DNF mantêm a oferta disponível para revanche. **Renovar ofertas abertas** troca os desafios ainda sem tentativa. **Trocar oferta** permite substituir um rival já enfrentado.

O jogador pode usar carros do capítulo ativo ou anteriores. As classes abaixo de Competição avaliam o tempo estimado da preparação atual para restringir carros muito acima da faixa. A inscrição registra a preparação válida e os identificadores do carro e da tentativa.

## Geração e save

A geração roda em um Web Worker no navegador. Usa os catálogos reais, os desbloqueios de oficina, o resolvedor de builds e os limites do Dyno Lab. Os candidatos são selecionados por estimativa física de tempo para a distância e a classe, com influência da pista, transmissão, aderência, potência, massa e perfil do piloto. Quando os candidatos disponíveis ficam fora da faixa, o gerador usa a configuração válida mais próxima entre as avaliadas. A corrida usa a física, IA e áudio da Campanha.

A versão 4 do save migra os saves anteriores. Os resultados livres da versão anterior conservam os dados originais, como piloto, tempos e créditos. Detalhes que a versão antiga não guardava, como pintura e pista, ficam disponíveis a partir dos novos registros. A migração começa com um quadro vazio.

O save guarda as últimas 30 assinaturas geradas, até 120 resultados livres e estatísticas acumuladas por capítulo. O histórico livre fica em **Histórico → Eventos Livres**. Recompensa, baixa da inscrição e histórico são gravados na mesma transação. Uma tentativa ou oferta já paga não pode ser reutilizada para outro pagamento.

## Verificação

```bash
npm test
npm run build
npx playwright test tests/e2e/free-events.spec.ts
npx tsx scripts/balance-free-events.ts
```

O relatório de balanceamento usa sementes fixas e simula os três capítulos com o controlador de corrida. A opção `--farm-only` isola o cenário do Chevette com as peças disponíveis após a Noite 4. O número de sementes pode ser informado como primeiro argumento. Na amostra de 16 provas de 402 m da classe Preparado, o Chevette aspirado venceu 13. O kit e a embreagem custam oito vitórias de 650 CR.
