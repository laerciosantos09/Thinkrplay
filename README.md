# Thinkrplay

App (PWA) de jogos de raciocínio com login e ranking diário, semanal, mensal e anual.

- **Front:** Vite + React + Tailwind, instalável como app (PWA)
- **API:** funções serverless da Vercel em `api/`
- **Banco:** Postgres no [Neon](https://neon.tech)

Jogos: Sudoku, Memória, Sequências, Torre de Hanói, Luzes e Código Secreto.

## Níveis e desafios

Cada jogo tem 3 níveis (**Easy**, **Medium**, **Hard**) com **500 desafios** cada (1.500 por jogo). Todo mundo começa no Easy.

- **Medium** abre, naquele jogo, ao resolver **10 desafios** do Easy.
- **Hard** abre, naquele jogo, ao resolver **20 desafios** do Medium.
- A tela de cada jogo mostra o **contador do próximo nível** ("Faltam N desafios no Easy", com barra de progresso), as regras de liberação e a observação de que só o primeiro acerto de cada desafio conta. O mesmo "faltam N" aparece nas abas, depois de cada vitória e nos cartões do painel.
- Os desafios de um nível abrem em sequência (resolveu o #7, abre o #8). Os já resolvidos podem ser repetidos, mas **só o primeiro acerto vale pontos**.
- Os desafios mudam de verdade conforme o nível, não só de tamanho: menos dicas no Sudoku, mais pares na Memória, regras mais complexas nas Sequências, tabuleiros maiores no Luzes, códigos mais longos (e com menos tentativas) no Código Secreto, e na Hanói mais discos em configurações embaralhadas.
- As regras de liberação ficam em `lib/tiers.ts` (`UNLOCK_RULES`); a dificuldade de cada jogo, no próprio `lib/<jogo>.ts`.
- Cada desafio tem sempre o mesmo puzzle. A semente vem de um HMAC com `CHALLENGE_SECRET` (ou `JWT_SECRET`), então ninguém consegue pré-calcular os desafios só lendo o código.

> Identidade visual (logo, cores, fontes): veja [`docs/identidade-visual.md`](docs/identidade-visual.md). O nome fica em `config.ts` (`APP_NAME`), `components/Logo.tsx`, `index.html` e `vite.config.ts` (manifest).
>
> Depois de comprar o domínio, troque `og:image` em `index.html` por uma URL absoluta (ex.: `https://seudominio.com/og-image.png`) para a prévia ao compartilhar funcionar nas redes.

## Publicar

1. **Neon:** crie um projeto e copie a connection string (*Pooled connection*).
2. **Criar as tabelas:**
   ```bash
   npm install
   DATABASE_URL="postgres://..." npm run db:migrate
   ```
3. **Vercel:** importe este repositório (preset Vite é detectado) e defina as variáveis de ambiente:
   - `DATABASE_URL` — string do Neon
   - `JWT_SECRET` — segredo aleatório com **32+ caracteres** (`openssl rand -base64 48`). Nunca reaproveite nem publique.

   Com a integração Neon da Vercel (Storage), `DATABASE_URL` e `DATABASE_URL_UNPOOLED` são criadas sozinhas. A API usa `DATABASE_URL` (com pool); os scripts de migração e de admin preferem `DATABASE_URL_UNPOOLED`. **`JWT_SECRET` não vem da integração: crie manualmente** (Production e Preview) e faça um novo deploy. Marque as variáveis como *Sensitive* na Vercel.
4. Faça o deploy. No celular, abra o site e use "Adicionar à tela inicial" para instalar.

## Perfil, termos e privacidade

- **Perfil** (clique no seu nome no menu): trocar o **nome de usuário** (único, sem diferenciar maiúsculas, diferente do e-mail, que nunca aparece para outros), **alterar a senha** (pede a atual e desconecta os outros dispositivos) e **excluir a conta** (pede a senha e a palavra EXCLUIR; apaga cadastro, pontuações, partidas e progresso, e libera e-mail e nome). O último administrador não pode se excluir.
- **Termos de Uso** (`/termos`) e **Política de Privacidade** (`/privacidade`, LGPD): páginas públicas, sem login — use a URL da privacidade na ficha das lojas de apps. O cadastro exige aceite, que é registrado com a versão (`LEGAL_VERSION` em `lib/legal.ts`). Ao mudar o texto de forma relevante, altere essa versão e todos veem a tela de aceite de novo.
- Seguem o mesmo formato do lilivro: página enxuta com "Última atualização", seções numeradas, link para o outro documento e uma tela "Quase lá!" para aceitar. Os textos estão em `content/legal.ts`. **São um modelo e devem ser revisados por um advogado** antes de publicar.
- O contato nos documentos é "o e-mail de suporte disponível na plataforma". Defina `VITE_SUPPORT_EMAIL` na Vercel (Environment Variables, valor público) para que esse e-mail apareça no Perfil, no rodapé e nos documentos. O build avisa se faltar.
- A sessão é invalidada na hora ao trocar/redefinir a senha ou excluir a conta (o servidor confere o usuário no banco a cada chamada).

## Rankings

- **Ranking Geral** (soma de todos os jogos) e **um por jogo**, em quatro períodos (diário, semanal, mensal e anual).
- São calculados no servidor a cada consulta a partir das pontuações: cada desafio concluído entra no ranking imediatamente. A tela atualiza sozinha a cada 20 s enquanto está aberta (e na hora, quando é você quem conclui).
- Mostram o top 10 e, para quem está logado, a própria posição mesmo fora do top 10.

## Limite de partidas ("energia")

Opcional e **desligado por padrão** (Configurações → Limite de partidas). Ligado, cada pessoa tem um estoque de partidas que **gasta 1 ao iniciar uma partida** e recarrega com o tempo:

| | Máximo em sequência | Recarga |
| --- | --- | --- |
| Grátis | 20 partidas | +1 a cada 10 min |
| Premium | 50 partidas | +1 a cada 2 min |

- Só **iniciar** gasta: botão **Jogar**, **Próximo desafio** e **Repetir**. Navegar entre desafios e níveis não gasta. Sem partidas, o botão Jogar fica bloqueado com a contagem regressiva e a oferta do Premium.
- O estoque é calculado e gasto **no servidor** de forma atômica (não dá para burlar abrindo várias abas), e o tempo parcial até a próxima recarga é preservado.
- O contador **⚡** fica fixo no topo: dentro do menu no computador e numa faixa logo abaixo dele no celular, em todas as telas.
- **Se o contador não aparecer:** (1) ligue em *Configurações → Limite de partidas* (vem desligado); (2) rode as migrações `005` e `007` no Neon, pois o painel do admin mostra um aviso amarelo com as que faltam (sem elas o jogo continua funcionando, só sem o limite); (3) recarregue o app (o app instalado busca a versão nova sozinho).
- Os números ficam em `lib/energy.ts`. Ao perder o Premium, o estoque volta ao limite do plano grátis.
- **Atenção ao ranking:** o ranking soma pontos, então quem pode jogar mais partidas por hora (Premium) tem vantagem de volume na competição.

## Plano Premium (Stripe)

Assinatura **mensal** que **remove os anúncios** e mostra o **selo ⭐** no perfil e nos rankings. **Não dá pontos extras** (os rankings seguem iguais para todos). Fica **desligado por padrão**; o administrador liga em **Configurações → Plano Premium**.

- O interruptor controla a **venda**: ligado + chaves do Stripe configuradas = o plano aparece. Desligado, ninguém assina, mas **quem já assina mantém os benefícios** e pode gerenciar/cancelar.
- Pagamento pela página do **Stripe Checkout**; cancelamento e troca de cartão pelo **portal do Stripe**. A confirmação chega por **webhook assinado** (`POST /api/billing`, conferido com HMAC e com proteção contra repetição e eventos fora de ordem).
- **Excluir a conta cancela a assinatura** no Stripe antes de apagar; se o cancelamento falhar, a exclusão é interrompida.
- Vale para a **web**. No app instalado das lojas (Apple/Google), assinatura de conteúdo digital exige a compra interna da loja, que é outro fluxo.

| Variável | Onde | O que é |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | servidor (Vercel) | chave secreta (`sk_test_...` para testar, `sk_live_...` em produção). **Sensitive.** |
| `STRIPE_PRICE_ID` | servidor | ID do preço recorrente (`price_...`) do produto Premium |
| `STRIPE_WEBHOOK_SECRET` | servidor | segredo do endpoint de webhook (`whsec_...`). **Sensitive.** |
| `APP_URL` | servidor, opcional | endereço do site (`https://seudominio.com`) usado nas URLs de retorno; sem ela usa o endereço da requisição |
| `VITE_PREMIUM_PRICE_LABEL` | build, opcional | texto do preço exibido na página (ex.: `R$ 9,90 por mês`); deve bater com o preço do Stripe |

**Como configurar**
1. No Stripe, crie um **produto** "Thinkrplay Premium" com **preço recorrente mensal** em BRL e copie o `price_...`.
2. Em *Developers → Webhooks*, crie um endpoint `https://seudominio.com/api/billing` com os eventos `customer.subscription.created`, `customer.subscription.updated` e `customer.subscription.deleted`, e copie o `whsec_...`.
3. Ative o **portal do cliente** em *Settings → Billing → Customer portal* (permita cancelar).
4. Defina as variáveis na Vercel e faça um novo deploy. Comece em **modo de teste** (`sk_test_...`, cartão `4242 4242 4242 4242`).
5. Em **Configurações → Plano Premium** o painel mostra se as chaves foram detectadas; ligue o interruptor.
6. Confira o webhook: no Stripe, *Send test webhook* deve responder **200**. Localmente: `stripe listen --forward-to localhost:3000/api/billing`.

> O endpoint do webhook desliga o leitor automático de corpo (`bodyParser: false`) para conferir a assinatura sobre o corpo bruto. Confirme com o teste do passo 6 depois do primeiro deploy.

## Segurança: o que o app já faz

- Senhas e palavra secreta só em hash (bcrypt); senha nova até 72 bytes; palavra secreta nova com 8+ caracteres e troca no Perfil.
- Bloqueio de tentativas: 8 erros por IP ou 15 por e-mail em 15 minutos; a recuperação por palavra secreta tem chave própria e teto de 20 erros por dia. Cadastro limitado a 20 por hora por IP.
- Partidas validadas no servidor; contadores de tentativas atômicos no banco (requisições paralelas não burlam o limite).
- "Sair em todos os aparelhos" no Perfil invalida todas as sessões.
- Defina na Vercel: `APP_URL`, `CHALLENGE_SECRET` e (com Apple) `OAUTH_TOKEN_KEY`; o painel do admin avisa se faltarem.
- Limites conhecidos: o app não confirma e-mail no cadastro (por isso a conta só é unificada com login social após confirmar a senha) e jogos de lógica podem ser resolvidos por robôs.

## Aceite dos Termos e da Privacidade

Cada documento é um **flag** do usuário (`terms_version` e `privacy_version`, com a data do aceite). Sem **os dois** aceitos na versão vigente, o usuário não usa o site nem o app: o servidor responde `403 terms_required` em todas as rotas (jogar, ranking, progresso, configurações, pagamento) e o app mostra a tela "Quase lá!". Só o Perfil funciona (registrar o aceite, sair, excluir a conta). Quem já aceitou não vê a tela de novo; ao mudar o texto de **um** documento, altere `TERMS_VERSION` ou `PRIVACY_VERSION` em `lib/legal.ts` e só aquele documento é pedido outra vez. Cadastro por senha exige marcar os dois; contas criadas pelo Google/Apple e admins criados por script aceitam no primeiro acesso. O admin vê os dois flags em **Cadastros**.

## Login com Google e Apple

Botões extras na tela de login (e **Contas conectadas** no Perfil). Ficam **desligados por padrão**; o administrador liga cada um em **Configurações → Login com Google e Apple**. O botão só aparece se estiver ligado **e** as variáveis abaixo existirem **e** a migração `008` tiver rodado.

| Variável (servidor, Vercel) | O que é |
| --- | --- |
| `GOOGLE_CLIENT_ID` | ID do cliente OAuth do Google (termina em `.apps.googleusercontent.com`) |
| `GOOGLE_CLIENT_SECRET` | segredo do cliente OAuth. **Sensitive.** |
| `APPLE_CLIENT_ID` | **Services ID** da Apple (ex.: `com.thinkrplay.web`), não o App ID |
| `APPLE_TEAM_ID` | Team ID da conta Apple Developer (10 caracteres) |
| `APPLE_KEY_ID` | ID da chave "Sign in with Apple" (10 caracteres) |
| `APPLE_PRIVATE_KEY` | conteúdo do arquivo `.p8`, em uma linha, com as quebras de linha como `\n`. **Sensitive.** |
| `APP_URL` | recomendada: `https://seudominio.com` (usada para montar a URL de retorno) |
| `OAUTH_TOKEN_KEY` | opcional: chave para cifrar o token da Apple no banco; sem ela usa `JWT_SECRET` |

**URLs de retorno (cadastre exatamente assim):** `https://seudominio.com/api/oauth/google` e `https://seudominio.com/api/oauth/apple`.

**Google:** Google Cloud Console → *APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth* (tipo "Aplicativo da Web"); em *Origens JavaScript autorizadas* ponha o domínio e em *URIs de redirecionamento* a URL do Google acima. Configure a *Tela de consentimento* (escopos básicos: e-mail, perfil e openid).

**Apple:** Apple Developer (conta paga) → *Identifiers*: crie um **App ID** com "Sign in with Apple" e um **Services ID** (será o `APPLE_CLIENT_ID`); no Services ID configure *Domains* (`seudominio.com`) e *Return URLs* (URL da Apple acima). Em *Keys* crie uma chave com "Sign in with Apple" e baixe o `.p8` (só baixa uma vez). A Apple não aceita `localhost`: teste em um domínio real.

**Como funciona (segurança):**
- Fluxo "código de autorização" no servidor, com `state` e `nonce` num cookie assinado de 10 minutos; o `id_token` é verificado (assinatura pelas chaves públicas do provedor, emissor, público, validade e nonce).
- Conta nova só é criada com e-mail **verificado** pelo provedor, e fica **sem senha** (pode definir uma no Perfil).
- **Uma conta só, três formas de entrar (senha, Google, Apple):** o login social com um e-mail que já tem conta entra nela quando o e-mail dessa conta já foi verificado por um provedor. Se a conta foi criada **com senha** (e-mail nunca confirmado), o app pede a **senha dela** antes de conectar o provedor (cadastro antecipado com o e-mail de outra pessoa não rouba a conta). Também dá para conectar em *Meu perfil → Contas conectadas*. Apple com e-mail privado ("ocultar e-mail") tem outro endereço: conecte pelo Perfil.
- **Origem e flags:** `users.signup_method` guarda por onde a conta foi criada; os tipos de login ativos (senha, Google, Apple) aparecem como etiquetas no Perfil e, para o admin, em **Configurações → 👥 Cadastros** (busca por nome ou e-mail).
- Sempre sobra uma forma de entrar: não dá para desconectar o único método.
- **Apple:** o token de atualização é guardado **cifrado** (AES-256-GCM) e é **revogado** ao excluir a conta ou desconectar a Apple (exigência da App Store). Se a revogação falhar, a exclusão é interrompida.
- Plano Hobby da Vercel: a API usa exatamente **12 funções** (o limite). Uma nova rota precisa entrar dentro de uma função existente.

## Anúncios (Google AdSense)

A estrutura já está pronta e **desligada por padrão**: nenhum script do Google é carregado até que (1) as variáveis abaixo existam, (2) o administrador ligue o interruptor em **Configurações → Anúncios** e (3) o usuário escolha no aviso de anúncios.

| Variável (build na Vercel) | O que é |
| --- | --- |
| `VITE_ADSENSE_CLIENT` | Seu identificador de editor, `ca-pub-XXXXXXXXXXXXXXXX` (AdSense → Conta → Informações da conta). Também gera o `/ads.txt` automaticamente. |
| `VITE_ADSENSE_SLOT_HOME` | ID do bloco de anúncio do painel de jogos |
| `VITE_ADSENSE_SLOT_RANKING` | ID do bloco da tela de ranking |
| `VITE_ADSENSE_SLOT_RESULT` | ID do bloco exibido depois de concluir um desafio |
| `VITE_ADSENSE_TEST` | Opcional: `true` mostra anúncios de **teste** (não contam impressões nem cliques) |

Para cada bloco, crie no AdSense um **bloco de anúncios** do tipo "Display" e use o número do `data-ad-slot` (10 dígitos). Variável sem valor = aquele espaço não mostra anúncio. Valores são públicos (vão embutidos no site), não marque como *Sensitive*.

**Como ligar quando tiver o domínio**
1. Publique o app no domínio próprio (o AdSense não aceita `*.vercel.app`) e cadastre o site no AdSense.
2. Aguarde a aprovação. Páginas públicas com texto (como `/termos` e `/privacidade`) ajudam, pois o app fica atrás de login.
3. Na Vercel, defina as variáveis acima (comece com `VITE_ADSENSE_TEST=true`) e faça um novo deploy.
4. Confira que `https://seudominio.com/ads.txt` mostra `google.com, pub-..., DIRECT, f08c47fec0942fa0`.
5. Em **Configurações → Anúncios**, ligue o interruptor. O painel mostra quais variáveis foram detectadas.
6. Teste, depois remova `VITE_ADSENSE_TEST` e faça novo deploy.

**Onde aparecem:** painel de jogos, ranking e depois de concluir um desafio (afastado dos botões). **Nunca** aparecem durante a partida, no login, no Perfil, no painel do admin nem nas páginas legais.

**Consentimento:** um aviso próprio pergunta se a pessoa aceita anúncios *personalizados* ou apenas *limitados*; a escolha fica no aparelho e pode ser mudada no Perfil. Se for distribuir na União Europeia ou no Reino Unido, o Google exige um aviso certificado (TCF): use o Funding Choices do próprio AdSense no lugar deste.

**Segurança (CSP):** `vercel.json` já libera os domínios do Google para anúncios (`*.googlesyndication.com`, `*.doubleclick.net` e afins). Se ao ligar os anúncios não aparecerem, abra o Console do navegador, procure mensagens "Refused to ..." e acrescente o domínio indicado à diretiva correspondente da CSP em `vercel.json`.

**Textos legais:** já mencionam anúncios de forma condicional ("se os anúncios estiverem ativos"). Revise-os com um advogado antes de ligar.

## Configurações do administrador

Quem tem perfil `admin` (veja "Criar o admin" abaixo) vê **⚙️ Configurações** no menu e pode ativar ou desativar cada jogo.

- Jogo desativado some do painel e do ranking, e o servidor recusa iniciar, continuar ou finalizar partidas dele.
- O progresso e os pontos ficam guardados; ao reativar, o jogo volta como estava.
- A permissão é conferida no banco a cada chamada (`users.role`), então rebaixar um admin vale na hora. A API de configurações é `GET/POST /api/settings` (jogos e anúncios).
- Tabelas: `game_settings` (jogo sem linha conta como ativo) e `app_settings` (recursos do app, como os anúncios; sem linha = desligado).

## Scripts do banco (Neon)

O SQL fica em **migrações numeradas** (`db/migrations/`). Cada uma roda sozinha e pode rodar várias vezes sem problema: as que já foram aplicadas não fazem nada. No Neon: SQL Editor → colar o arquivo → Run, **em ordem**.

| Arquivo | O que faz |
| --- | --- |
| `db/migrations/001_base.sql` | Usuários, pontuações, partidas e tentativas de login |
| `db/migrations/002_levels_tiers.sql` | Níveis Easy/Medium/Hard: coluna `tier` e tabela `tier_progress` (**remove** a antiga `progress`) |
| `db/migrations/003_game_settings.sql` | Configurações do admin (jogos ativos/desativados) |
| `db/migrations/004_profile_terms_rankings.sql` | Perfil (versão de sessão), aceite dos Termos e índice do ranking geral |
| `db/migrations/005_app_settings.sql` | Configurações gerais do app (interruptor dos anúncios) |
| `db/migrations/006_premium.sql` | Plano Premium: `subscriptions` e `stripe_events` |
| `db/migrations/007_play_energy.sql` | Limite de partidas em sequência (`play_energy`) |
| `db/migrations/008_oauth_login.sql` | Login com Google/Apple: `oauth_identities` e senha opcional |
| `db/migrations/009_signup_method.sql` | Origem do cadastro (`signup_method`) e `email_verified` |
| `db/migrations/010_privacy_acceptance.sql` | Aceite separado da Política de Privacidade (`privacy_version`) |
| `db/schema.sql` | Tudo junto, para banco novo. **Gerado** das migrações (`npm run db:schema`) |
| `scripts/create-admin.mjs` | Cria ou redefine a senha de um admin. Grava **só o hash bcrypt**. |
| `db/maintenance.sql` | Limpeza periódica de partidas e tentativas antigas |
| `db/drop_all.sql` | Apaga tudo (só desenvolvimento) |

Ao mudar o banco, **crie uma nova migração** (`005_...sql`) em vez de editar as antigas, e rode `npm run db:schema`. `npm test` confere que as migrações, o `schema.sql` e a atualização de bancos de versões anteriores chegam à mesma estrutura, sem perder dados. `npm run db:migrate` aplica todas as migrações pela linha de comando.

Criar o admin, de duas formas (a senha nunca vai para arquivo nem para o SQL):
```bash
# 1) direto no banco (pergunta e-mail, usuário e senha, com a senha oculta)
DATABASE_URL="postgres://..." npm run db:admin

# 2) só gerar o SQL para colar no SQL Editor do Neon
npm run db:admin:sql
```
Para trocar a senha do admin, rode o script de novo com o mesmo e-mail.

Para rodar os scripts com as variáveis baixadas da Vercel (Node 20+):
```bash
node --env-file=.env.local scripts/migrate.mjs
node --env-file=.env.local scripts/create-admin.mjs
```

## Desenvolvimento local

```bash
npx vercel env pull .env.local   # baixa DATABASE_URL etc. do projeto (ou: cp .env.example .env e preencha)
npm install
npx vercel dev              # serve o front e /api juntos
npm run typecheck && npm test
```

## Segurança e antitrapaça

- **Servidor é a autoridade.** Cada partida nasce em `POST /api/play/start` (semente sorteada no servidor, nível precisa estar liberado).
  - *Sudoku, Memória, Hanói, Luzes:* o navegador envia a prova (tabuleiro final / lista de jogadas) e o servidor **refaz a partida** a partir da semente. Os pontos são calculados lá, nunca recebidos do cliente.
  - *Sequências e Código Secreto:* a resposta/código **nunca sai do servidor**; cada palpite é conferido em `POST /api/play/guess`.
- Cada partida só pontua uma vez (conclusão atômica no banco), só o primeiro acerto de cada desafio pontua (repetição não rende pontos), expira em 3 h e é recusada se for rápida demais para um humano.
- Limite de 200 partidas/hora por usuário; bloqueio de 15 min após 8 falhas de login/recuperação (por e-mail e por IP).
- Sessão em cookie `HttpOnly; Secure; SameSite=Strict` (o JavaScript não enxerga o token), checagem de origem nos POSTs, senhas e palavra secreta com bcrypt.
- Cabeçalhos de segurança (CSP, HSTS, X-Frame-Options etc.) em `vercel.json`.

Limite que continua existindo: um programa que *resolve* o Sudoku/Hanói de verdade e respeita o ritmo humano é indistinguível de um jogador muito rápido. O sistema impede pontuação inventada, reenvio, pular níveis e bots instantâneos, mas não "robô esperto". Para reduzir isso, ajuste `MIN_SECONDS_PER_ACTION` em `lib/scoring.ts`.

## Testes

```bash
npm run typecheck
npm test          # lógica dos jogos (500 desafios únicos por nível, dificuldade crescente) + API completa
                  # (Postgres em memória, sem precisar do Neon)
```

`scripts/e2e-server.mjs` sobe o app compilado com a API real e banco em memória para testar no navegador (`npm run build && npx tsx scripts/e2e-server.mjs`, porta 4174).

## Observações

- Versão antiga: rodava no Azure Web App `passatemposp`. Depois de publicar na Vercel, desative/remova esse app no portal do Azure para não deixar uma cópia desatualizada no ar.
- A pasta `Nova pasta/` é material antigo (Firebase/Azure) e é ignorada no deploy (`.vercelignore`).
