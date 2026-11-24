# Nitro contínuo

Segure Shift esquerdo para solicitar injeção. A tecla pode ser remapeada. Solte para interromper a vazão e guardar o restante. Pressione de novo para iniciar outra rampa no mesmo cilindro. Cada tentativa nova começa com o cilindro cheio. A pausa encerra a injeção e exige outro pressionamento ao retomar.

## Ajuste e medição

Quando o carro tem um kit, a aba Nitro do Dyno Lab oferece vazão de 25% a 100%, em passos de 5%, e uma entrada progressiva até o limite do kit. O ajuste permanece no rascunho do Dyno Lab até aplicar. A prévia mostra duração contínua, potência de referência, torque na rotação indicada, risco mecânico e aderência estimada em segunda marcha. A potência nominal usa a vazão selecionada e a potência de referência do kit. O torque estimado também considera a alimentação disponível.

O ensaio de pista pode usar nitro desligado, contínuo ou estratégico. No último caso, o piloto reduz o uso quando falta aderência. Os resultados incluem a massa efetivamente consumida, o tempo de injeção e o pico de potência adicional observado. A curva de bancada mede a vazão configurada em regime.

## Como a física funciona

A vazão segue uma rampa suave com mínimo de 0,06 s. A simulação integra a rampa durante cada passo a 120 Hz e limita a massa injetada pelo conteúdo do cilindro. Motor desligado ou quebrado, baixa rotação e cortes de combustível, ignição ou limitador interrompem o fluxo. Quando o motor volta a aceitar nitro e Shift continua pressionado, a injeção reinicia a rampa. O torque adicional entra pelo virabrequim e passa pela transmissão e pelos pneus. O HUD mostra a massa restante e a iluminação, o chiado e as partículas seguem a vazão efetiva.

## Saves e presets

O save v5 preserva a garagem, o histórico, os saldos e os quatro kits. Acertos antigos de uma tomada passam a usar diretamente a vazão e a rampa originais. Para duas tomadas, cada valor é a média ponderada pela divisão antiga do cilindro. A migração respeita o limite de rampa do kit. A nova regulagem aproxima a intenção do acerto antigo e pode produzir tempos diferentes. Os presets antigos do Sandbox passam pela mesma conversão na leitura. A carga restante pertence à tentativa atual.

## Validação manual

1. No Sandbox, escolha o Chevette Wet Performance. Com o carro em marcha e acima da rotação mínima do kit, segure Shift e confira o estado INJETANDO e a redução da carga.
2. Solte Shift. Confira PRONTO e aguarde com o motor acelerado para confirmar que o percentual permanece estável. Pressione de novo para retomar a partir da carga anterior.
3. Pause enquanto injeta, pressione Shift durante a pausa e retome. Faça um novo pressionamento para voltar a injetar. Reinicie para confirmar 100% de carga.
4. Na Campanha, instale um kit e abra Dyno Lab → Nitro. Compare vazões de 25%, 50%, 75% e 100%. Verifique a autonomia, aplique um ajuste e recarregue o save.
5. Compare os ensaios desligado, contínuo e estratégico. Para reproduzir a matriz dos 11 carros, execute `npx tsx scripts/nitrous-balance.ts`.

[Resultados de balanceamento](NITROUS_BALANCE.md)
