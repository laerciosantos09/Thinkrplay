// Páginas públicas (sem login): é o conteúdo que o Google (e os visitantes) enxergam antes de entrar no app.
// Este arquivo é só dados (sem imports do app): a mesma fonte alimenta a tela em React (pages/PublicPage.tsx)
// e o HTML pré-renderizado gerado no build (vite.config.ts), que é o que os buscadores leem.

export const SITE_URL = 'https://thinkrplay.com';

export interface PublicBlock {
  heading: string;
  paragraphs?: string[];
  list?: string[];
  ordered?: boolean; // lista numerada (passo a passo)
}

export interface PublicPageData {
  path: string; // "/" é a página inicial para quem não está logado
  slug: string;
  navLabel?: string;
  title: string; // título da aba (SEO)
  description: string; // meta description
  h1: string;
  lead: string;
  icon?: string;
  blocks: PublicBlock[];
  related?: string[]; // caminhos de outras páginas
  cta: string;
}

const TIERS = 'Cada jogo tem três níveis, **Easy**, **Medium** e **Hard**, com 500 desafios em cada um (1.500 por jogo). Todo mundo começa no Easy; resolver 10 desafios do Easy abre o Medium, e resolver 20 desafios do Medium abre o Hard.';
const plain = (s: string) => s.replace(/\*\*/g, '');
export const tiersText = plain(TIERS);

const game = (g: Omit<PublicPageData, 'path' | 'cta' | 'related'> & { slug: string }): PublicPageData => ({
  ...g,
  path: `/jogos/${g.slug}`,
  related: ['/jogos'],
  cta: 'Jogar grátis',
});

export const GAME_PAGES: PublicPageData[] = [
  game({
    slug: 'sudoku', icon: '🔢', navLabel: 'Sudoku',
    title: 'Sudoku online grátis: como jogar e dicas | Thinkrplay',
    description: 'Jogue Sudoku online grátis em três níveis, com 500 desafios por nível e solução única. Veja as regras, o passo a passo e dicas para resolver mais rápido.',
    h1: 'Sudoku online',
    lead: 'O clássico jogo de lógica com números, em 1.500 desafios, todos com uma única solução possível.',
    blocks: [
      { heading: 'Como jogar Sudoku', ordered: true, list: [
        'Preencha a grade de 9×9 com números de 1 a 9.',
        'Cada linha precisa ter todos os números de 1 a 9, sem repetir.',
        'Cada coluna também precisa ter os números de 1 a 9, sem repetir.',
        'Cada quadrado de 3×3 (são nove na grade) segue a mesma regra.',
        'Os números que já aparecem no início são as dicas e não podem ser alterados.',
      ] },
      { heading: 'Níveis e desafios', paragraphs: [
        plain(TIERS),
        'No Easy a grade começa com mais números prontos (de 40 a 36 dicas); no Medium restam de 34 a 30; no Hard, de 29 a 25. Quanto menos dicas, mais raciocínio é preciso.',
        'Todo desafio tem uma única solução: não é necessário chutar, sempre existe um caminho lógico até o fim.',
      ] },
      { heading: 'Dicas para resolver mais rápido', list: [
        'Comece pelas linhas, colunas e quadrados que já têm mais números preenchidos.',
        'Procure o número que só cabe em uma casa de um quadrado (a "única possibilidade").',
        'Anote mentalmente os candidatos de cada casa e elimine os que já aparecem na mesma linha, coluna ou quadrado.',
        'Se travar, mude de região: resolver outra parte da grade costuma destravar a que parecia impossível.',
      ] },
      { heading: 'Por que jogar', paragraphs: [
        'O Sudoku exercita a atenção, a memória de trabalho e o raciocínio dedutivo. Como cada desafio tem pontuação e entra no ranking, dá para acompanhar a sua evolução do Easy ao Hard.',
      ] },
    ],
  }),
  game({
    slug: 'memory', icon: '🧩', navLabel: 'Memória',
    title: 'Jogo da Memória online: como jogar e dicas | Thinkrplay',
    description: 'Jogo da Memória online grátis com níveis Easy, Medium e Hard. Encontre todos os pares com o menor número de jogadas. Regras e dicas para treinar a memória.',
    h1: 'Jogo da Memória',
    lead: 'Vire as cartas, encontre os pares e treine a memória visual com desafios cada vez maiores.',
    blocks: [
      { heading: 'Como jogar', ordered: true, list: [
        'Todas as cartas começam viradas para baixo.',
        'Toque em duas cartas para virá-las.',
        'Se forem iguais, o par fica revelado. Se forem diferentes, elas viram de volta.',
        'Guarde na memória o lugar de cada figura que apareceu.',
        'O desafio termina quando todos os pares forem encontrados. Quanto menos jogadas, melhor a pontuação.',
      ] },
      { heading: 'Níveis e desafios', paragraphs: [
        plain(TIERS),
        'O número de pares cresce com o nível: no Easy são de 4 a 6 pares, no Medium de 6 a 9, e no Hard de 9 a 12.',
      ] },
      { heading: 'Dicas', list: [
        'Percorra as cartas em ordem nas primeiras jogadas para ver o máximo de figuras possível.',
        'Associe a posição de cada figura a algo (por exemplo, "o cachorro está no canto").',
        'Evite virar cartas ao acaso quando já souber onde está o par de uma figura.',
        'Fazer pausas curtas ajuda a manter a atenção nos níveis maiores.',
      ] },
      { heading: 'Por que jogar', paragraphs: ['O jogo da memória trabalha a memória de curto prazo, a atenção visual e a concentração, e é simples de começar para qualquer idade.'] },
    ],
  }),
  game({
    slug: 'sequence', icon: '🔍', navLabel: 'Sequências',
    title: 'Jogo de Sequências Numéricas: como jogar e dicas | Thinkrplay',
    description: 'Descubra o próximo número da sequência. Jogo de raciocínio lógico com progressões, quadrados, Fibonacci e regras compostas, em três níveis.',
    h1: 'Sequências numéricas',
    lead: 'Observe os números, descubra a regra escondida e escolha o próximo termo da sequência.',
    blocks: [
      { heading: 'Como jogar', ordered: true, list: [
        'Uma sequência de números é mostrada com o último termo em aberto.',
        'Descubra a regra que liga os números (somar, multiplicar, alternar, usar potências...).',
        'Escolha, entre as opções, o número que continua a sequência.',
        'Cada desafio tem algumas rodadas seguidas; cada erro reduz a pontuação.',
      ] },
      { heading: 'Níveis e desafios', paragraphs: [
        plain(TIERS),
        'No Easy aparecem progressões simples (somar ou subtrair o mesmo valor, multiplicar). No Medium entram diferenças crescentes, quadrados e sequências intercaladas. No Hard há Fibonacci, cubos e regras compostas.',
      ] },
      { heading: 'Dicas', list: [
        'Calcule a diferença entre termos vizinhos: se ela for constante, é uma progressão simples.',
        'Se a diferença cresce, calcule a diferença das diferenças.',
        'Quando os números parecem "pular", pode ser uma sequência intercalada: olhe só os termos de posições ímpares e depois os pares.',
        'Reconhecer quadrados (1, 4, 9, 16...) e cubos (1, 8, 27...) ajuda muito nos níveis altos.',
      ] },
      { heading: 'Por que jogar', paragraphs: ['Identificar padrões é a base do raciocínio lógico e matemático. Este jogo treina essa habilidade em pequenas doses diárias.'] },
    ],
  }),
  game({
    slug: 'hanoi', icon: '🗼', navLabel: 'Torre de Hanói',
    title: 'Torre de Hanói online: regras, solução e dicas | Thinkrplay',
    description: 'Jogue a Torre de Hanói online com 4 a 8 discos. Veja as regras, o número mínimo de movimentos e uma estratégia para resolver sem se perder.',
    h1: 'Torre de Hanói',
    lead: 'Mova a pilha de discos de um pino para outro, com planejamento e o menor número de movimentos.',
    blocks: [
      { heading: 'Regras', ordered: true, list: [
        'Há três pinos e uma pilha de discos de tamanhos diferentes.',
        'Você pode mover apenas um disco por vez.',
        'Só é possível mover o disco que está no topo de um pino.',
        'Um disco maior nunca pode ficar em cima de um disco menor.',
        'O objetivo é levar todos os discos para o pino de destino indicado.',
      ] },
      { heading: 'Níveis e desafios', paragraphs: [
        plain(TIERS),
        'O número de discos vai de 4 a 8, e as configurações iniciais variam: nem todo desafio começa com os discos empilhados no primeiro pino, e o pino de destino também muda.',
        'Para cada desafio existe um mínimo possível de movimentos, calculado pelo jogo. Resolver perto desse mínimo rende mais pontos.',
      ] },
      { heading: 'Estratégia', list: [
        'Pense de trás para frente: para mover o maior disco, todos os menores precisam estar no terceiro pino.',
        'Para uma torre de n discos, o mínimo é 2ⁿ − 1 movimentos (15 para 4 discos, 255 para 8).',
        'O menor disco se move a cada dois movimentos, sempre na mesma direção.',
        'Se perder o rumo, reduza o problema: resolva a torre sem o disco maior e depois recoloque-o.',
      ] },
      { heading: 'Por que jogar', paragraphs: ['A Torre de Hanói é um clássico do raciocínio recursivo e do planejamento, usado até em aulas de computação. Aqui ela vem com desafios variados e cronometrados.'] },
    ],
  }),
  game({
    slug: 'lights', icon: '💡', navLabel: 'Luzes',
    title: 'Jogo das Luzes (Lights Out) online: como jogar | Thinkrplay',
    description: 'Apague todas as luzes do tabuleiro! Jogo de lógica Lights Out online com tabuleiros de 3×3 a 7×7. Regras, estratégia e dicas para resolver.',
    h1: 'Luzes (Lights Out)',
    lead: 'Cada toque acende e apaga as luzes vizinhas. Descubra a sequência certa para apagar o tabuleiro inteiro.',
    blocks: [
      { heading: 'Como jogar', ordered: true, list: [
        'O tabuleiro é uma grade de lâmpadas, algumas acesas e outras apagadas.',
        'Ao tocar em uma lâmpada, ela e as quatro vizinhas (cima, baixo, esquerda e direita) trocam de estado.',
        'O objetivo é deixar todas as lâmpadas apagadas.',
        'Quanto menos toques, melhor a pontuação.',
      ] },
      { heading: 'Níveis e desafios', paragraphs: [
        plain(TIERS),
        'Os tabuleiros vão de 3×3 a 7×7, e a quantidade de toques necessária cresce com o nível.',
      ] },
      { heading: 'Estratégia', list: [
        'Tocar duas vezes na mesma lâmpada desfaz o efeito: cada lâmpada só precisa ser tocada, no máximo, uma vez.',
        'A ordem dos toques não importa; importa quais lâmpadas você toca.',
        'Um método comum é "empurrar" as luzes acesas para a última linha, linha por linha, e resolver o que sobrar.',
        'Se o tabuleiro parecer impossível, desfaça os últimos toques e tente outro caminho.',
      ] },
      { heading: 'Por que jogar', paragraphs: ['O jogo das luzes trabalha o raciocínio lógico e a visão de padrões, e é um bom exemplo de como a matemática aparece em quebra-cabeças simples.'] },
    ],
  }),
  game({
    slug: 'mastermind', icon: '🎯', navLabel: 'Código Secreto',
    title: 'Código Secreto (Mastermind) online: regras e estratégia | Thinkrplay',
    description: 'Decifre o código secreto no jogo Mastermind online. Use as dicas de cores certas e posições certas para descobrir a combinação em poucas tentativas.',
    h1: 'Código Secreto (Mastermind)',
    lead: 'Descubra a combinação de cores escondida usando as pistas de cada tentativa.',
    blocks: [
      { heading: 'Como jogar', ordered: true, list: [
        'O jogo esconde uma combinação de cores (uma mesma cor pode aparecer mais de uma vez).',
        'Você monta um palpite com a mesma quantidade de posições.',
        'O jogo responde com duas pistas: quantas cores estão certas e na posição certa, e quantas existem no código mas estão na posição errada.',
        'Use as pistas para eliminar possibilidades e refinar o próximo palpite.',
        'Você vence ao acertar o código dentro do limite de tentativas.',
      ] },
      { heading: 'Níveis e desafios', paragraphs: [
        plain(TIERS),
        'O código tem 4, 5 ou 6 posições, com 6, 7 ou 8 cores disponíveis conforme o nível, e o número de tentativas é limitado. A resposta fica sempre no servidor: o jogo confere cada palpite, então não há como espiar o código.',
      ] },
      { heading: 'Estratégia', list: [
        'No primeiro palpite, use cores variadas para obter o máximo de informação.',
        'Anote cada palpite e sua resposta: a lógica vem de cruzar as pistas.',
        'Se uma tentativa tem zero cores certas, você eliminou todas aquelas cores de uma vez.',
        'Mude uma única coisa por vez quando estiver perto da solução, para saber o que causou a mudança na pista.',
      ] },
      { heading: 'Por que jogar', paragraphs: ['O Código Secreto treina o raciocínio dedutivo e a tomada de decisão com informação incompleta.'] },
    ],
  }),
];

export const GAMES_INDEX: PublicPageData = {
  path: '/jogos', slug: 'jogos', navLabel: 'Jogos',
  title: 'Jogos de raciocínio online grátis | Thinkrplay',
  description: 'Sudoku, Memória, Sequências, Torre de Hanói, Luzes e Código Secreto: seis jogos de raciocínio online, com três níveis e 500 desafios cada.',
  h1: 'Jogos de raciocínio',
  lead: 'Seis jogos para treinar lógica, memória e atenção, cada um com três níveis e 500 desafios por nível.',
  blocks: [
    { heading: 'Todos os jogos', list: GAME_PAGES.map((g) => `${g.icon} ${g.navLabel}: ${g.lead}`) },
    { heading: 'Como a progressão funciona', paragraphs: [plain(TIERS), 'Só o primeiro acerto de cada desafio vale pontos; repetir um desafio é permitido, mas serve só para praticar.'] },
  ],
  related: GAME_PAGES.map((g) => g.path),
  cta: 'Jogar grátis',
};

export const ABOUT: PublicPageData = {
  path: '/sobre', slug: 'sobre', navLabel: 'Sobre',
  title: 'Sobre o Thinkrplay: jogos de raciocínio para treinar a mente',
  description: 'Conheça o Thinkrplay: um app de jogos de raciocínio com níveis, ranking e partidas validadas no servidor para uma competição justa.',
  h1: 'Sobre o Thinkrplay',
  lead: 'Um espaço para treinar a mente com jogos de lógica, de poucos minutos por partida.',
  blocks: [
    { heading: 'O que é', paragraphs: [
      'O Thinkrplay reúne jogos de raciocínio (Sudoku, Memória, Sequências, Torre de Hanói, Luzes e Código Secreto) em um só lugar, no navegador e no celular. A proposta é simples: partidas curtas, desafios que ficam mais difíceis aos poucos e um ranking para quem gosta de competir.',
    ] },
    { heading: 'Competição justa', paragraphs: [
      'Cada partida é iniciada e validada pelo servidor. Nos jogos em que a resposta poderia ser espiada, como o Código Secreto e as Sequências, a resposta nunca é enviada ao seu aparelho. Nos demais, o servidor refaz a partida a partir da sua prova e recusa partidas rápidas demais para um jogador humano. Só o primeiro acerto de cada desafio vale pontos, o que impede repetir o mesmo desafio para subir no ranking.',
    ] },
    { heading: 'Rankings', paragraphs: [
      'Há um ranking geral (soma de todos os jogos) e um por jogo, com recortes diário, semanal, mensal e anual. Só o seu nome de usuário e a pontuação aparecem; o seu e-mail nunca é exibido.',
    ] },
    { heading: 'Privacidade e controle', paragraphs: [
      'Você escolhe um nome de usuário, pode excluir a conta a qualquer momento pelo Perfil, e as senhas são guardadas apenas como hash irreversível. Os detalhes estão nos Termos de Uso e na Política de Privacidade.',
    ] },
    { heading: 'Contato', paragraphs: ['Dúvidas ou sugestões? Fale com o suporte pelo e-mail indicado no rodapé desta página.'] },
  ],
  related: ['/jogos', '/faq', '/termos', '/privacidade'],
  cta: 'Criar conta grátis',
};

export const FAQ: PublicPageData = {
  path: '/faq', slug: 'faq', navLabel: 'Perguntas frequentes',
  title: 'Perguntas frequentes | Thinkrplay',
  description: 'Respostas rápidas: o Thinkrplay é grátis? Como liberar níveis, como funciona a pontuação e o ranking, dados pessoais e exclusão de conta.',
  h1: 'Perguntas frequentes',
  lead: 'As dúvidas mais comuns sobre o Thinkrplay.',
  blocks: [
    { heading: 'O Thinkrplay é grátis?', paragraphs: ['Sim. Todos os jogos e níveis podem ser jogados sem pagar. Existe um plano Premium opcional, que remove os anúncios e mostra um selo no seu perfil; ele não dá pontos extras.'] },
    { heading: 'Preciso criar uma conta?', paragraphs: ['Sim, para guardar o progresso e aparecer no ranking. O cadastro pode ser feito com e-mail e senha ou com a sua conta Google ou Apple.'] },
    { heading: 'Como libero os níveis Medium e Hard?', paragraphs: ['Dentro de cada jogo: resolva 10 desafios do Easy para abrir o Medium e 20 desafios do Medium para abrir o Hard. A tela do jogo mostra quanto falta.'] },
    { heading: 'Como funciona a pontuação?', paragraphs: ['Cada desafio resolvido gera pontos, calculados pelo servidor, que consideram o tempo, os erros e o número de jogadas. Só o primeiro acerto de cada desafio vale pontos; repetir serve para praticar.'] },
    { heading: 'Como funciona o ranking?', paragraphs: ['Há o ranking geral e um por jogo, nos períodos diário, semanal, mensal e anual. Ele é atualizado a cada desafio concluído.'] },
    { heading: 'Posso jogar no celular?', paragraphs: ['Sim. O site funciona no navegador do celular e pode ser instalado na tela inicial. Também há versões para Android e iOS.'] },
    { heading: 'Por que uma partida foi recusada?', paragraphs: ['O servidor valida todas as partidas. Uma partida concluída rápido demais para um jogador humano, ou com uma jogada inválida, não é pontuada.'] },
    { heading: 'Quais dados vocês guardam?', paragraphs: ['O nome de usuário, o e-mail, as partidas e pontuações, e a situação da assinatura se você for Premium. As senhas ficam só como hash. Veja a Política de Privacidade para os detalhes.'] },
    { heading: 'Como excluo a minha conta?', paragraphs: ['No Perfil, em "Excluir conta". Seus dados, pontuações e progresso são apagados e você sai de todos os rankings imediatamente.'] },
    { heading: 'Esqueci a minha senha. E agora?', paragraphs: ['Na tela de entrada, use "Esqueci minha senha" e informe o e-mail e a palavra secreta que você cadastrou.'] },
  ],
  related: ['/jogos', '/sobre'],
  cta: 'Criar conta grátis',
};

export const HOME: PublicPageData = {
  path: '/', slug: 'inicio',
  title: 'Thinkrplay: jogos de raciocínio online grátis (Sudoku, Hanói e mais)',
  description: 'Treine a mente com Sudoku, Torre de Hanói, Sequências, Memória, Luzes e Código Secreto. Níveis Easy, Medium e Hard, 500 desafios por nível e ranking.',
  h1: 'Treine a mente. Divirta-se. Suba no ranking.',
  lead: 'Jogos de raciocínio para jogar no navegador e no celular, com desafios que ficam mais difíceis aos poucos.',
  blocks: [
    { heading: 'Seis jogos para treinar lógica, memória e atenção', list: GAME_PAGES.map((g) => `${g.icon} ${g.navLabel}: ${g.lead}`) },
    { heading: 'Como funciona', ordered: true, list: [
      'Crie a sua conta grátis, com e-mail ou com Google ou Apple.',
      'Escolha um jogo e comece pelo nível Easy.',
      'Resolva desafios para ganhar pontos e liberar o Medium e o Hard.',
      'Acompanhe o seu lugar nos rankings diário, semanal, mensal e anual.',
    ] },
    { heading: 'Por que o Thinkrplay', list: [
      `${plain(TIERS)}`,
      'Partidas curtas, de poucos minutos, boas para qualquer momento do dia.',
      'Competição justa: o servidor valida cada partida e só o primeiro acerto de cada desafio vale pontos.',
      'Funciona no navegador e no celular, e pode ser instalado como aplicativo.',
    ] },
  ],
  related: ['/jogos', '/sobre', '/faq'],
  cta: 'Começar grátis',
};

export const PUBLIC_PAGES: PublicPageData[] = [HOME, GAMES_INDEX, ...GAME_PAGES, ABOUT, FAQ];
export const PUBLIC_BY_PATH: Record<string, PublicPageData> = Object.fromEntries(PUBLIC_PAGES.map((p) => [p.path, p]));

// Rótulos dos links relacionados (inclui as páginas legais, que ficam em content/legal.ts)
export const LINK_LABELS: Record<string, string> = {
  ...Object.fromEntries(PUBLIC_PAGES.map((p) => [p.path, p.navLabel ?? p.h1])),
  '/termos': 'Termos de Uso',
  '/privacidade': 'Política de Privacidade',
};
