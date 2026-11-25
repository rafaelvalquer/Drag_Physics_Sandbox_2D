# Multiplayer online 1.0

A aba **Online** abre a garagem vinculada à conta Google. A Campanha usa os saves locais e o seu próprio catálogo de desbloqueios. Apenas a entrada no modo Online carrega o cliente de autenticação e estabelece conexão com os serviços online.

## Desenvolvimento local

Requer Node.js 22.12 ou posterior. Use `npm ci` para instalar as versões registradas no lockfile. `npm run dev` inicia o frontend. `npm run online:proof` inicia uma prova de dois clientes com carros originais na interface de loopback. O servidor competitivo é iniciado com `npm run online:server` e recebe as variáveis do ambiente. Para usar um arquivo local, copie `.env.example` para `.env` e execute `node --env-file=.env --import tsx src/server/online/start.ts`.

## Google e Supabase

1. Crie projetos Supabase separados para homologação e produção. Use o projeto local da CLI ou um projeto separado para desenvolvimento. Aplique as migrations com `supabase db reset` no ambiente local ou `supabase db push` após vincular a CLI ao projeto correto. Configure a autenticação Google em cada projeto que usará OAuth.
2. Configure a marca e a tela de consentimento na Google Auth Platform. Crie um cliente OAuth do tipo aplicação web, cadastre os domínios autorizados do jogo e adicione a URI `https://<PROJECT_REF>.supabase.co/auth/v1/callback`. Em **Branding**, informe o e-mail de suporte e os endereços do jogo, da página `/online/privacidade.html` e da página `/online/termos.html` no domínio da implantação. Para um app de teste, inclua as contas que farão a homologação. [Configuração de marca do Google](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
3. No provedor Google do Supabase, registre o Client ID e o Client Secret do Google. Em **Authentication → URL Configuration**, defina a URL do frontend e permita o caminho completo `/auth/callback` de cada ambiente autorizado, incluindo `http://localhost:5173/auth/callback` em desenvolvimento. O jogo usa PKCE e os escopos `openid email profile`. [Configuração do Google no Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) · [URLs de retorno](https://supabase.com/docs/guides/auth/redirect-urls)
4. Use a chave pública nas variáveis `VITE_*`. Configure a chave secreta e a URL PostgreSQL apenas no backend. No painel do Supabase, use **Connect** para copiar a URL de conexão direta ou do pooler em modo Session para ambientes IPv4. Use TLS para o banco remoto, por exemplo com `sslmode=require` na URL de conexão. [Conexão PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres)

## Backend e Netlify

1. Escolha um host para o backend e associe a branch de homologação. No Railway, use o `Dockerfile` e `railway.toml`, cadastre as variáveis do backend e gere o domínio público. No Render, importe `render.yaml` como Blueprint e preencha as quatro variáveis solicitadas. O Blueprint usa uma instância gratuita para homologação, com suspensão após 15 minutos sem tráfego e retomada que pode levar cerca de um minuto. [Dockerfiles no Railway](https://docs.railway.com/builds/dockerfiles) · [Blueprints no Render](https://render.com/docs/blueprint-spec) · [Limites do Render Free](https://render.com/docs/free)
2. Na Netlify, associe o mesmo commit e configure as quatro variáveis públicas antes de gerar o bundle. Use `https://<backend>` para `VITE_ONLINE_API_URL` e `wss://<backend>` para `VITE_ONLINE_WS_URL`. O `netlify.toml` publica `dist` e atende `/auth/callback` com a página do jogo. [Rewrites da Netlify](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/)
3. No backend, inclua o domínio HTTPS exato da Netlify em `ALLOWED_ORIGINS` e confirme que `https://<backend>/health` retorna HTTP 200. No Supabase, acrescente o callback HTTPS correspondente. Refaça o build da Netlify quando mudar uma variável `VITE_*`. Encerre partidas em andamento antes de trocar a implantação. Ao iniciar, o servidor classifica partidas `running` como canceladas. Use projetos e saldos iniciais separados para homologação. Mantenha o padrão de 4.500 CR e 1.000 RP em produção.

## Autoridade e persistência

- O servidor verifica assinatura, emissor, audiência, validade e origem Google dos tokens do Supabase. O UUID do token identifica a conta. A API aplica limites por IP e conta, e o WebSocket limita a taxa e o tamanho das mensagens.
- O Colyseus agrupa dois jogadores por sala. A seleção dura 30 segundos por padrão e usa o carro ativo se o piloto aguardar sem escolher outro. A partida aguarda os dois clientes carregarem e usa builds imutáveis com hash, versão, seed e revisão. O servidor bloqueia operações de garagem durante a fila e a partida.
- O `SimulationRunner` e o `RaceController` executam a física em passos de 1/120 s. O cliente envia comandos aproximadamente a 30 Hz e o servidor publica snapshots a 20 Hz. As entradas têm sequência e janela de idade. O semáforo usa um relógio estimado por RTT. A primeira versão interpola posições, áudio e rotação das rodas. O servidor usa o RTT medido com ping/pong WebSocket antes da largada para atrasar em até 12 ticks a aplicação dos inputs do piloto com menor RTT. A física avança sem comandos retroativos. O efeito dessa política em redes reais ainda depende da homologação.
- As alterações de garagem usam UUID de operação, bloqueio por perfil e revisão de build. CR é global, RP usa Elo com K=32 e PP é atribuído ao veículo do snapshot. O ledger e os resultados são atualizados na mesma transação. RLS expõe consultas privadas do titular e o catálogo versionado. O ranking é servido pela API com campos públicos selecionados.
- A garagem inicial é limitada a 25 veículos. Veículos vendidos preservam o histórico. A Saveiro, que não tem oferta da campanha, inicia no online a 2.600 CR. As árvores usam as peças reais, os estágios e os limites do resolver. Comprar, instalar e desbloquear são operações separadas.
- O servidor registra jogos repetidos e mudanças consecutivas de vencedor para inspeção, aplica supressão por falta de participação efetiva e evita a concessão em duplicidade. Para abuso confirmado, um administrador pode inserir em `online_reward_holds` o percentual de CR e PP que continuará sendo concedido, o motivo e a expiração. O resultado preserva o motivo. A repetição de rivais por si só não altera a recompensa. Queima de largada e quebra de motor contam como participação.

## Validação

| Verificação | Comando ou evidência |
|---|---|
| Tipos e bundle do navegador | `npm run build` |
| Resolver, árvores e regras de corrida | `npm test -- tests/unit/online` |
| Dois clientes TCP e WebSocket, migração PostgreSQL, JWT, garagem e recompensas | `npm test -- tests/integration/online` |
| Dois navegadores, callback PKCE, login repetido e corrida com controles reais | `npm run test:e2e:online` |
| Regressões de campanha e oficina no navegador | `npm run test:e2e` |

Os testes de integração usam portas de loopback atribuídas pelo sistema. O PostgreSQL embarcado usa PGlite. Os testes de JWT e navegador usam tokens assinados por um provedor de teste local. O teste no navegador valida o desafio PKCE, usa o servidor competitivo e salva as duas telas de resultado no artefato `online-browser-results` do GitHub Actions.

Para medir concorrência local, configure `ONLINE_PROOF_PAIRS=8` e execute `npm test -- tests/integration/online/proof-race.test.ts`. A prova abre oito salas com dezesseis clientes WebSocket e valida que cada par recebe o mesmo resultado. O workflow de multiplayer executa essa carga junto aos testes de integração e de unidade. Os logs do servidor competitivo registram o custo médio da física, o tempo descartado, o maior intervalo de atualização e o menor RTT medido para cada piloto.

Para homologar, entre com contas Google diferentes em dois dispositivos, cadastre nicknames únicos, recarregue a garagem após sair e voltar, selecione carros, dispute uma corrida de 402,336 m e confronte os dois tempos oficiais. Interrompa temporariamente a rede durante outra corrida e confirme se a sessão retorna. Verifique a alteração de CR e RP no ranking e o PP nos dois veículos utilizados. Capture a tela de resultado de cada dispositivo com o mesmo **ID da partida** e registre o commit e as condições de rede. Use esse ID para localizar o evento `online-race-metrics` no backend e anexar `ticks`, `meanStepMs`, `droppedMs`, `maxFrameMs` e `minRttMs` à evidência.

O teste de homologação deve cobrir rede móvel e Wi‑Fi, diferentes combinações de transmissão e tração, rejeição de seleção alheia, timeout na carga e recuperação após restart. O resultado de dois usuários Google em dispositivos distintos deve ser anexado ao PR antes da publicação pública.
