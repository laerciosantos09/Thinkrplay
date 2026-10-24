# Identidade visual — Thinkrplay

**Conceito:** *pensar + jogar*. Um balão de pensamento que contém o botão de play: raciocínio em forma de diversão. As bolinhas menta que saem do balão reforçam a ideia de pensamento.

## Nome
- Escreva **Thinkrplay** (uma palavra, T maiúsculo, resto minúsculo).
- No logotipo: **Thinkr** em branco/escuro + **play** em destaque (menta no escuro, violeta no claro).

## Logo
| Arquivo | Uso |
| --- | --- |
| `public/icon.svg` | Símbolo com fundo (ícone do app, favicon) |
| `public/mark.svg` | Símbolo sem fundo, para usar sobre qualquer cor |
| `public/icon-maskable.svg` | Versão para ícones adaptativos do Android |
| `public/og-image.png` | Imagem de compartilhamento (1200×630) |
| `components/Logo.tsx` | Logo (símbolo + nome) no app: `<Logo tone="dark" />` em fundo escuro, `tone="light"` em fundo claro |

Regras: deixe uma margem livre de pelo menos metade da altura do símbolo; não distorça, não troque as cores, não aplique sombra. Tamanho mínimo do símbolo: 16 px.

Para regenerar todos os PNGs/SVGs: `node scripts/make-brand-assets.cjs` (e atualize `components/Logo.tsx` se mudar o desenho).

## Cores
| Nome | Hex | Uso |
| --- | --- | --- |
| Violeta Think (`brand-600`) | `#6a35f5` | Cor principal, botões, links |
| Violeta claro (`brand-400`) | `#9672ff` | Gradientes, realces |
| Violeta profundo (`brand-900`) | `#3a1f85` | Sombras do gradiente, texto de apoio |
| Azul-noite (`ink-900`) | `#0f0a26` | Fundos escuros, barra de navegação, texto principal |
| Menta Play (`mint-400`) | `#2ee6a6` | Destaque da palavra "play", sucesso, bolinhas |
| Fundo claro | `#f7f5ff` | Fundo das telas |

Os tokens estão em `index.css` (`@theme`), prontos para usar como `bg-brand-600`, `text-ink-900`, `text-mint-400` etc.
Cada jogo tem um gradiente próprio em `config.ts` para ser reconhecível de relance.

## Tipografia
- **Sora** (700–800): títulos e logotipo. Classe `font-display` (aplicada automaticamente a `h1–h3`).
- **Inter** (400–700): texto de interface.

## Tom de voz
Direto, animado e encorajador. Frases curtas e verbos de ação: "Treine a mente. Divirta-se. Suba no ranking."
