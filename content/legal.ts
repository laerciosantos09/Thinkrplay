import { APP_NAME, LEGAL_CONTACT_EMAIL, LEGAL_CONTROLLER } from '../config';
import { LEGAL_UPDATED_LABEL, LEGAL_VERSION } from '../lib/legal';

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
  after?: string[]; // parágrafos depois da lista
}

export interface LegalDocument {
  path: string;
  title: string;
  intro: string;
  sections: LegalSection[];
}

const versionLine = `Versão ${LEGAL_VERSION}, atualizada em ${LEGAL_UPDATED_LABEL}.`;

export const TERMS: LegalDocument = {
  path: '/termos',
  title: 'Termos de Uso',
  intro: `Estes Termos de Uso regulam o uso do ${APP_NAME}. Leia com atenção: ao criar uma conta ou usar o app, você concorda com eles e com a Política de Privacidade. ${versionLine}`,
  sections: [
    {
      title: 'Aceitação',
      paragraphs: [
        `Ao criar uma conta ou usar o ${APP_NAME}, você declara que leu e concorda com estes Termos e com a Política de Privacidade. Se não concordar, não use o app.`,
      ],
    },
    {
      title: 'O serviço',
      paragraphs: [
        `O ${APP_NAME} oferece jogos de raciocínio (como Sudoku, Memória, Sequências, Torre de Hanói, Luzes e Código Secreto) com níveis Easy, Medium e Hard, progresso por jogo e rankings. O serviço é oferecido gratuitamente e no estado em que se encontra.`,
      ],
    },
    {
      title: 'Sua conta',
      items: [
        'Você precisa ter 13 anos ou mais. Menores de 18 anos devem usar o app com ciência e autorização de um responsável legal.',
        'Informe um e-mail válido e que seja seu. Ele é usado para entrar e nunca é exibido para outros usuários.',
        'Escolha um nome de usuário único. Ele aparece nos rankings. Não é permitido usar nomes ofensivos, que se passem por outra pessoa ou pela equipe do app.',
        'Mantenha sua senha e sua palavra secreta em sigilo. Você é responsável pelas atividades feitas na sua conta. Avise-nos se suspeitar de uso indevido.',
      ],
    },
    {
      title: 'Regras de uso',
      paragraphs: ['Para que o jogo seja justo para todos, é proibido:'],
      items: [
        'trapacear: usar robôs, scripts, macros ou qualquer automação, alterar o app, ou enviar dados falsos ao servidor para ganhar pontos, níveis ou posições;',
        'explorar falhas do app em vez de comunicá-las a nós;',
        'tentar acessar contas, dados ou sistemas de outras pessoas, ou sobrecarregar o serviço;',
        'usar o app para fins ilegais, ofensivos ou discriminatórios;',
        'copiar, revender ou explorar comercialmente o app sem autorização.',
      ],
    },
    {
      title: 'Pontos, níveis e rankings',
      paragraphs: [
        'A pontuação e o progresso são calculados e validados no servidor. Em cada desafio, apenas o primeiro acerto vale pontos; repetir um desafio já resolvido é permitido, mas não pontua. Os níveis Medium e Hard são liberados conforme as regras exibidas em cada jogo.',
        'Seu nome de usuário, sua pontuação e a quantidade de desafios resolvidos aparecem publicamente nos rankings (diário, semanal, mensal e anual, por jogo e geral).',
        'Podemos corrigir ou remover pontuações suspeitas ou obtidas de forma indevida, redefinir rankings e suspender contas que violem estes Termos.',
      ],
    },
    {
      title: 'Disponibilidade e mudanças no app',
      paragraphs: [
        'Podemos alterar, desativar ou remover jogos, níveis e desafios, e suspender o serviço para manutenção ou por razões técnicas. Não garantimos funcionamento ininterrupto nem livre de erros.',
      ],
    },
    {
      title: 'Propriedade intelectual',
      paragraphs: [
        `A marca, o logotipo, o design, os textos e o código do ${APP_NAME} pertencem a nós ou a nossos licenciantes. Concedemos a você uma licença pessoal, limitada, revogável e não exclusiva para usar o app. Você não pode copiar, modificar ou distribuir o app ou seu conteúdo sem autorização.`,
      ],
    },
    {
      title: 'Encerramento da conta',
      paragraphs: [
        'Você pode excluir sua conta a qualquer momento em Perfil > Excluir conta. Seus dados são apagados conforme a Política de Privacidade. Podemos suspender ou encerrar contas que violem estes Termos ou a lei.',
      ],
    },
    {
      title: 'Responsabilidade',
      paragraphs: [
        'Nos limites da lei, incluindo o Código de Defesa do Consumidor, não respondemos por danos indiretos nem pela perda de pontos, níveis ou progresso causada por falhas técnicas, indisponibilidade ou ação de terceiros, salvo em caso de dolo ou culpa grave. Nada nestes Termos limita direitos que a lei garante a você como consumidor.',
      ],
    },
    {
      title: 'Mudanças nestes Termos',
      paragraphs: [
        'Podemos atualizar estes Termos. Quando a mudança for relevante, pediremos que você os aceite novamente antes de continuar usando o app. A versão e a data de atualização ficam no topo desta página.',
      ],
    },
    {
      title: 'Lei aplicável e foro',
      paragraphs: [
        'Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro do domicílio do consumidor para resolver conflitos, conforme o Código de Defesa do Consumidor.',
      ],
    },
    {
      title: 'Contato',
      paragraphs: [`Responsável: ${LEGAL_CONTROLLER}. Dúvidas sobre estes Termos: ${LEGAL_CONTACT_EMAIL}.`],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  path: '/privacidade',
  title: 'Política de Privacidade',
  intro: `Esta Política explica como o ${APP_NAME} trata os dados pessoais dos usuários, em conformidade com a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018). ${versionLine}`,
  sections: [
    {
      title: 'Quem somos',
      paragraphs: [
        `O controlador dos seus dados pessoais é ${LEGAL_CONTROLLER}. Para falar sobre privacidade ou exercer seus direitos, inclusive com o Encarregado pelo tratamento de dados pessoais, escreva para ${LEGAL_CONTACT_EMAIL}.`,
      ],
    },
    {
      title: 'Dados que coletamos',
      items: [
        'Cadastro: nome de usuário, e-mail e senha. A senha e a palavra secreta de recuperação são guardadas apenas como hash (um código irreversível): nunca ficam em texto aberto e nem nós conseguimos lê-las.',
        'Uso do app: partidas, desafios resolvidos, pontuações, progresso por jogo e nível, e as datas correspondentes.',
        'Aceite: a versão dos Termos e da Política que você aceitou e quando.',
        'Segurança: o e-mail e o endereço IP de tentativas de login ou de recuperação de senha que falharam, guardados por curto período (cerca de 1 dia) para barrar tentativas de invasão.',
        'Dados técnicos de conexão (como IP e tipo de navegador) registrados nos logs dos servidores de hospedagem.',
      ],
      after: ['Não coletamos localização, contatos, câmera, microfone nem dados pessoais sensíveis.'],
    },
    {
      title: 'Para que usamos seus dados',
      items: [
        'Criar e manter sua conta e permitir que você jogue (execução de contrato, art. 7º, V, da LGPD).',
        'Calcular progresso, pontos e rankings (execução de contrato).',
        'Proteger o app contra fraude, trapaça e acessos indevidos (legítimo interesse, art. 7º, IX).',
        'Registrar seu aceite dos Termos e da Política (consentimento, art. 7º, I).',
        'Cumprir obrigações legais e responder a autoridades (art. 7º, II).',
      ],
    },
    {
      title: 'O que é público',
      paragraphs: [
        'Seu nome de usuário, sua pontuação e a quantidade de desafios resolvidos aparecem nos rankings para outros usuários. Seu e-mail nunca é exibido. Se preferir não ser identificado, escolha um nome de usuário que não revele quem você é; você pode trocá-lo quando quiser no Perfil.',
      ],
    },
    {
      title: 'Com quem compartilhamos',
      paragraphs: [
        'Não vendemos seus dados e não usamos publicidade nem ferramentas de rastreamento de terceiros. Usamos prestadores de serviço (operadores) apenas para o app funcionar: Vercel (hospedagem e execução do servidor) e Neon (banco de dados). Eles tratam os dados somente para nos prestar esses serviços. Também podemos compartilhar dados com autoridades quando a lei exigir.',
      ],
    },
    {
      title: 'Transferência internacional',
      paragraphs: [
        'Os provedores acima podem armazenar dados em servidores fora do Brasil (por exemplo, nos Estados Unidos). Nesses casos, contamos com as garantias previstas na LGPD (art. 33), como as cláusulas contratuais dos próprios provedores.',
      ],
    },
    {
      title: 'Cookies e armazenamento no aparelho',
      paragraphs: [
        'Usamos um único cookie essencial, de sessão (HttpOnly, Secure e SameSite=Strict), para mantê-lo conectado. Ele não é usado para publicidade e não pode ser lido por scripts. O app também guarda arquivos em cache no seu aparelho para carregar mais rápido e funcionar como app instalado. Não usamos cookies de análise ou de publicidade.',
      ],
    },
    {
      title: 'Por quanto tempo guardamos',
      paragraphs: [
        'Enquanto sua conta existir. Ao excluir a conta (Perfil > Excluir conta), apagamos seus dados cadastrais, pontuações, partidas e progresso, e você sai dos rankings imediatamente. Cópias de segurança mantidas pelos provedores podem levar um curto período adicional para serem sobrescritas. Podemos reter dados mínimos pelo tempo que a lei exigir.',
      ],
    },
    {
      title: 'Seus direitos',
      paragraphs: ['Conforme o art. 18 da LGPD, você pode, a qualquer momento:'],
      items: [
        'confirmar que tratamos seus dados e ter acesso a eles;',
        'corrigir dados incompletos ou desatualizados (o nome de usuário você altera no Perfil);',
        'pedir anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;',
        'pedir a portabilidade dos seus dados;',
        'eliminar seus dados e encerrar sua conta (Perfil > Excluir conta);',
        'saber com quem compartilhamos seus dados;',
        'revogar o consentimento e peticionar à Autoridade Nacional de Proteção de Dados (ANPD).',
      ],
      after: [`Para exercer seus direitos, use o Perfil ou escreva para ${LEGAL_CONTACT_EMAIL}. Respondemos em até 15 dias.`],
    },
    {
      title: 'Segurança',
      paragraphs: [
        'Protegemos seus dados com senhas guardadas em hash, conexão criptografada (HTTPS), cookie de sessão inacessível a scripts, limite de tentativas de acesso e validação das partidas no servidor. Nenhum sistema é totalmente seguro; se houver um incidente relevante, comunicaremos você e a ANPD conforme a lei.',
      ],
    },
    {
      title: 'Crianças e adolescentes',
      paragraphs: [
        'O app é voltado a pessoas com 13 anos ou mais. Menores de 18 anos devem usá-lo com ciência e autorização de um responsável legal. Não coletamos intencionalmente dados de menores de 13 anos; se identificarmos, excluiremos a conta.',
      ],
    },
    {
      title: 'Mudanças nesta Política',
      paragraphs: [
        'Podemos atualizar esta Política. Quando a mudança for relevante, pediremos que você a aceite novamente. A versão e a data de atualização ficam no topo desta página.',
      ],
    },
  ],
};
