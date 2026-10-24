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
   - `JWT_SECRET` — segredo longo (`openssl rand -base64 48`)

   Alternativamente, a integração Neon da Vercel (Storage) cria `DATABASE_URL` sozinha.
4. Faça o deploy. No celular, abra o site e use "Adicionar à tela inicial" para instalar.

## Desenvolvimento local

```bash
cp .env.example .env        # preencha DATABASE_URL e JWT_SECRET
npm install
npx vercel dev              # serve o front e /api juntos
npm run typecheck && npm test
```

## Observações

- A pontuação é calculada no navegador; a API valida jogo, nível liberado e um teto de pontos por partida, mas isso não impede trapaça determinada. Para um ranking competitivo de verdade, mova a validação das partidas para o servidor.
- A pasta `Nova pasta/` é material antigo (Firebase/Azure) e é ignorada no deploy (`.vercelignore`).
