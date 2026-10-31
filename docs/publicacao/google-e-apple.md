# Thinkrplay · textos e arquivos prontos para Google e Apple

Domínio oficial: **https://thinkrplay.com** (sem www). Copie cada valor exatamente como está.

## Arquivos (nesta pasta)

| Arquivo | Onde usar |
| --- | --- |
| `logo-google-120x120.png` | Google → Branding → App logo (exige PNG/JPG quadrado, até 1 MB; 120×120 é o tamanho recomendado) |
| `logo-512x512.png` | Play Store (ícone do app, 512×512), Resend, redes sociais |
| `logo-1024x1024.png` | App Store (ícone 1024×1024, sem cantos arredondados nem transparência) |

---

## 1) GOOGLE · Google Cloud → projeto `thinkrplay` → Google Auth Platform

### Branding

| Campo | Valor |
| --- | --- |
| App name | `Thinkrplay` |
| User support email | `suporte@thinkrplay.com` (se o Google não aceitar ainda, use o seu e-mail e troque depois) |
| App logo | `logo-google-120x120.png` |
| Application home page | `https://thinkrplay.com` |
| Application privacy policy link | `https://thinkrplay.com/privacidade` |
| Application terms of service link | `https://thinkrplay.com/termos` |
| Authorized domains | `thinkrplay.com` |
| Developer contact information | seu e-mail (só o Google vê) |

### Audience

- User type: **External**
- Depois de tudo configurado: **Publish app** (Publicar). Sem isso só os "test users" entram.

### Data Access (escopos)

Somente estes (não exigem verificação do Google):

```
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

### Clients → Create client

| Campo | Valor |
| --- | --- |
| Application type | `Web application` |
| Name | `Thinkrplay Web` |
| Authorized JavaScript origins | `https://thinkrplay.com` |
| Authorized redirect URIs | `https://thinkrplay.com/api/oauth/google` |

Ao criar, copie o **Client ID** e o **Client secret** para a Vercel (`GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`, o segundo como *Sensitive*). Não cole o secret em conversas nem em arquivos do repositório.

### Se o Google pedir uma descrição do app ou justificativa de uso (texto pronto)

> Thinkrplay é um app de jogos de raciocínio (Sudoku, Torre de Hanói, Sequências, Luzes, Memória e Código Secreto) com ranking. O login com Google serve apenas para criar a conta e entrar: usamos o nome e o e-mail verificado da conta Google para identificar o jogador. Não acessamos nenhum outro dado do Google (e-mails, contatos, arquivos, agenda) e não compartilhamos esses dados. O jogador pode excluir a conta a qualquer momento pelo Perfil, o que apaga todos os dados.

### Se pedir confirmação de propriedade do domínio (Search Console)

1. Abra https://search.google.com/search-console e adicione a propriedade **Domínio** `thinkrplay.com`.
2. Ele mostra um registro **TXT**. No painel da Hostinger (Domínios → DNS), crie: tipo `TXT`, nome `@`, valor igual ao que o Google mostrou.
3. Volte ao Search Console e clique em **Verificar** (pode levar alguns minutos).

---

## 2) APPLE · developer.apple.com → Certificates, Identifiers & Profiles

Exige o Apple Developer Program (US$ 99/ano).

### a) Identifiers → + → App IDs → App

| Campo | Valor |
| --- | --- |
| Description | `Thinkrplay` |
| Bundle ID (Explicit) | `com.thinkrplay.app` |
| Capabilities | marcar **Sign in with Apple** |

### b) Identifiers → + → Services IDs

| Campo | Valor |
| --- | --- |
| Description | `Thinkrplay Web` |
| Identifier | `com.thinkrplay.web` (este é o `APPLE_CLIENT_ID`) |

Depois: abra o Services ID → marque **Sign in with Apple** → **Configure**:

| Campo | Valor |
| --- | --- |
| Primary App ID | `Thinkrplay (com.thinkrplay.app)` |
| Domains and Subdomains | `thinkrplay.com` |
| Return URLs | `https://thinkrplay.com/api/oauth/apple` |

### c) Keys → +

| Campo | Valor |
| --- | --- |
| Key Name | `Thinkrplay Sign in with Apple` |
| Serviços | marcar **Sign in with Apple** → Configure → Primary App ID `Thinkrplay` |

Baixe o `.p8` (**só baixa uma vez**, guarde em local seguro, fora do repositório). O **Key ID** aparece na página da chave. O **Team ID** fica em Membership details.

### d) (Recomendado) E-mails para quem escondeu o e-mail na Apple

Certificates, Identifiers & Profiles → **Services** → *Sign in with Apple for Email Communication* → Configure:

| Campo | Valor |
| --- | --- |
| Domains | `mail.thinkrplay.com` |
| Email Sources | `nao-responda@mail.thinkrplay.com` |

(Isso permite que e-mails do app cheguem a quem usou o "ocultar e-mail" da Apple. Exige os registros SPF/DKIM do Resend no subdomínio `mail`.)

### Variáveis na Vercel

| Variável | Valor |
| --- | --- |
| `APPLE_CLIENT_ID` | `com.thinkrplay.web` |
| `APPLE_TEAM_ID` | _(seu Team ID, 10 caracteres)_ |
| `APPLE_KEY_ID` | _(Key ID da chave, 10 caracteres)_ |
| `APPLE_PRIVATE_KEY` | _(conteúdo do .p8, Sensitive)_ |

Para colocar o `.p8` em uma linha (PowerShell):

```powershell
(Get-Content .\AuthKey_XXXXXXXXXX.p8 -Raw) -replace "`r?`n", '\n'
```

---

## 3) VERCEL · variáveis do servidor (Production)

| Variável | Valor | Sensitive |
| --- | --- | --- |
| `APP_URL` | `https://thinkrplay.com` | |
| `GOOGLE_CLIENT_ID` | _(do Google)_ | |
| `GOOGLE_CLIENT_SECRET` | _(do Google)_ | sim |
| `APPLE_CLIENT_ID` | `com.thinkrplay.web` | |
| `APPLE_TEAM_ID` | _(da Apple)_ | |
| `APPLE_KEY_ID` | _(da Apple)_ | |
| `APPLE_PRIVATE_KEY` | _(do .p8)_ | sim |
| `OAUTH_TOKEN_KEY` | _(gere abaixo)_ | sim |
| `CHALLENGE_SECRET` | _(gere abaixo)_ | sim |
| `RESEND_API_KEY` | _(do Resend)_ | sim |
| `EMAIL_FROM` | `Thinkrplay <nao-responda@mail.thinkrplay.com>` | |
| `VITE_SUPPORT_EMAIL` | `suporte@thinkrplay.com` | |

Gerar uma chave aleatória (rode duas vezes, uma para cada variável):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Depois de salvar as variáveis: **novo deploy**, rodar no Neon as migrações `008` a `013` (se ainda não rodou) e ligar os interruptores em **Configurações** (Login com Google, Login com Apple, Confirmação de e-mail).

## 4) Conferência final

- [ ] `https://www.thinkrplay.com` redireciona para `https://thinkrplay.com`
- [ ] `https://thinkrplay.com/termos` e `/privacidade` abrem sem login
- [ ] Painel do admin: ✅ nas variáveis do Google e da Apple
- [ ] Login com Google em janela anônima, com uma conta que não é a sua de teste
- [ ] Login com Apple (precisa de domínio verificado e conta paga)
- [ ] Cadastro por e-mail e senha recebe o e-mail de confirmação (caixa de entrada e spam)
