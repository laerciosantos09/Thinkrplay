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

## Configurações do administrador

Quem tem perfil `admin` (veja "Criar o admin" abaixo) vê **⚙️ Configurações** no menu e pode ativar ou desativar cada jogo.

- Jogo desativado some do painel e do ranking, e o servidor recusa iniciar, continuar ou finalizar partidas dele.
- O progresso e os pontos ficam guardados; ao reativar, o jogo volta como estava.
- A permissão é conferida no banco a cada chamada (`users.role`), então rebaixar um admin vale na hora. A API de configurações é `GET/POST /api/games`.
- Tabela: `game_settings` (jogo sem linha conta como ativo).

## Scripts do banco (Neon)

O SQL fica em **migrações numeradas** (`db/migrations/`). Cada uma roda sozinha e pode rodar várias vezes sem problema: as que já foram aplicadas não fazem nada. No Neon: SQL Editor → colar o arquivo → Run, **em ordem**.

| Arquivo | O que faz |
| --- | --- |
| `db/migrations/001_base.sql` | Usuários, pontuações, partidas e tentativas de login |
| `db/migrations/002_levels_tiers.sql` | Níveis Easy/Medium/Hard: coluna `tier` e tabela `tier_progress` (**remove** a antiga `progress`) |
| `db/migrations/003_game_settings.sql` | Configurações do admin (jogos ativos/desativados) |
| `db/migrations/004_profile_terms_rankings.sql` | Perfil (versão de sessão), aceite dos Termos e índice do ranking geral |
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
