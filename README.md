# Mentalize

App (PWA) de jogos de raciocínio com login e ranking diário, semanal, mensal e anual.

- **Front:** Vite + React + Tailwind, instalável como app (PWA)
- **API:** funções serverless da Vercel em `api/`
- **Banco:** Postgres no [Neon](https://neon.tech)

Jogos (até 1000 níveis cada, com liberação progressiva): Sudoku, Memória, Sequências, Torre de Hanói, Luzes e Código Secreto.

> O nome do app fica em `config.ts` (`APP_NAME`), `index.html` e `vite.config.ts` (manifest). Para trocar, edite esses três pontos.

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

   Alternativamente, a integração Neon da Vercel (Storage) cria `DATABASE_URL` sozinha.
4. Faça o deploy. No celular, abra o site e use "Adicionar à tela inicial" para instalar.

## Desenvolvimento local

```bash
cp .env.example .env        # preencha DATABASE_URL e JWT_SECRET
npm install
npx vercel dev              # serve o front e /api juntos
npm run typecheck && npm test
```

## Segurança e antitrapaça

- **Servidor é a autoridade.** Cada partida nasce em `POST /api/play/start` (semente sorteada no servidor, nível precisa estar liberado).
  - *Sudoku, Memória, Hanói, Luzes:* o navegador envia a prova (tabuleiro final / lista de jogadas) e o servidor **refaz a partida** a partir da semente. Os pontos são calculados lá, nunca recebidos do cliente.
  - *Sequências e Código Secreto:* a resposta/código **nunca sai do servidor**; cada palpite é conferido em `POST /api/play/guess`.
- Cada partida só pontua uma vez (conclusão atômica no banco), expira em 3 h e é recusada se for rápida demais para um humano.
- Limite de 200 partidas/hora por usuário; bloqueio de 15 min após 8 falhas de login/recuperação (por e-mail e por IP).
- Sessão em cookie `HttpOnly; Secure; SameSite=Strict` (o JavaScript não enxerga o token), checagem de origem nos POSTs, senhas e palavra secreta com bcrypt.
- Cabeçalhos de segurança (CSP, HSTS, X-Frame-Options etc.) em `vercel.json`.

Limite que continua existindo: um programa que *resolve* o Sudoku/Hanói de verdade e respeita o ritmo humano é indistinguível de um jogador muito rápido. O sistema impede pontuação inventada, reenvio, pular níveis e bots instantâneos, mas não "robô esperto". Para reduzir isso, ajuste `MIN_SECONDS_PER_ACTION` em `lib/scoring.ts`.

## Testes

```bash
npm run typecheck
npm test          # lógica dos jogos + API completa (Postgres em memória, sem precisar do Neon)
```

`scripts/e2e-server.mjs` sobe o app compilado com a API real e banco em memória para testar no navegador (`npm run build && npx tsx scripts/e2e-server.mjs`, porta 4174).

## Observações

- Versão antiga: rodava no Azure Web App `passatemposp`. Depois de publicar na Vercel, desative/remova esse app no portal do Azure para não deixar uma cópia desatualizada no ar.
- A pasta `Nova pasta/` é material antigo (Firebase/Azure) e é ignorada no deploy (`.vercelignore`).
