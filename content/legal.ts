import { APP_NAME, SUPPORT_EMAIL } from '../config';
import { LEGAL_UPDATED_LABEL } from '../lib/legal';

export interface LegalSection {
  title: string;
  text: string;
}

export interface LegalDocument {
  path: string;
  title: string;
  updated: string;
  sections: LegalSection[];
  otherPath: string;
  otherLabel: string;
}

const support = SUPPORT_EMAIL ? ` (${SUPPORT_EMAIL})` : '';

export const TERMS: LegalDocument = {
  path: '/termos',
  title: 'Termos de Uso',
  updated: LEGAL_UPDATED_LABEL,
  otherPath: '/privacidade',
  otherLabel: 'Ver Política de Privacidade',
  sections: [
    {
      title: 'Aceitação dos Termos',
      text: `Ao criar uma conta ou usar o ${APP_NAME}, você concorda com estes Termos de Uso e com a Política de Privacidade. Se não concordar, não utilize o serviço.`,
    },
    {
      title: 'Descrição do Serviço',
      text: `O ${APP_NAME} é uma plataforma de jogos de raciocínio (Sudoku, Memória, Sequências, Torre de Hanói, Luzes e Código Secreto) com níveis Easy, Medium e Hard, progresso por jogo e rankings diário, semanal, mensal e anual.`,
    },
    {
      title: 'Cadastro e Conta',
      text: 'Você é responsável por manter a confidencialidade das suas credenciais de acesso e se compromete a fornecer informações verdadeiras no cadastro. É proibido criar contas em nome de terceiros sem autorização. O serviço é destinado a maiores de 13 anos; menores de 18 anos devem usá-lo com ciência de um responsável legal.',
    },
    {
      title: 'Uso Aceitável',
      text: 'É proibido: utilizar o serviço para fins ilegais; escolher nome de usuário ofensivo, discriminatório ou que se passe por outra pessoa ou pela equipe; tentar acessar contas de outros usuários; trapacear com robôs, scripts, automação ou alteração do app para ganhar pontos, níveis ou posições; realizar engenharia reversa ou extrair dados da plataforma de forma automatizada.',
    },
    {
      title: 'Pontuação e Rankings',
      text: 'A pontuação e o progresso são calculados e validados no servidor, e apenas o primeiro acerto de cada desafio vale pontos. Seu nome de usuário, sua pontuação e a quantidade de desafios resolvidos aparecem publicamente nos rankings. Podemos corrigir ou remover pontuações obtidas de forma indevida e suspender contas que violem estes Termos.',
    },
    {
      title: 'Disponibilidade e Alterações do Serviço',
      text: 'Podemos alterar, desativar ou remover jogos, níveis e desafios, e suspender o serviço para manutenção. Não garantimos funcionamento ininterrupto.',
    },
    {
      title: 'Anúncios',
      text: 'Podemos exibir anúncios de terceiros (Google AdSense) para manter o serviço gratuito. Não controlamos nem endossamos o conteúdo dos anúncios nem os sites para onde levam. É proibido clicar em anúncios de forma artificial ou induzir outras pessoas a isso.',
    },
    {
      title: 'Encerramento de Conta',
      text: 'Você pode excluir sua conta a qualquer momento no seu Perfil. Ao excluir, todos os seus dados são removidos permanentemente, sem possibilidade de recuperação, e você deixa os rankings imediatamente. Podemos encerrar contas que violem estes Termos.',
    },
    {
      title: 'Limitação de Responsabilidade',
      text: `O ${APP_NAME} é fornecido "como está". Nos limites da lei, não nos responsabilizamos por interrupções do serviço, perda de pontos ou de progresso e danos indiretos decorrentes do uso da plataforma. Nada nestes Termos limita os direitos que a lei garante a você como consumidor.`,
    },
    {
      title: 'Alterações nos Termos',
      text: 'Podemos atualizar estes Termos periodicamente. Quando a mudança for relevante, avisaremos na plataforma e pediremos que você aceite novamente antes de continuar usando o serviço.',
    },
    {
      title: 'Contato',
      text: `Dúvidas sobre estes Termos podem ser enviadas para o e-mail de suporte disponível na plataforma${support}.`,
    },
  ],
};

export const PRIVACY: LegalDocument = {
  path: '/privacidade',
  title: 'Política de Privacidade',
  updated: LEGAL_UPDATED_LABEL,
  otherPath: '/termos',
  otherLabel: 'Ver Termos de Uso',
  sections: [
    {
      title: 'Dados Coletados',
      text: 'Coletamos: nome de usuário, endereço de e-mail, senha e palavra secreta de recuperação (guardadas apenas como hash irreversível, nunca em texto), partidas, desafios resolvidos, pontuações e progresso. Por segurança, guardamos por cerca de 1 dia o e-mail e o endereço IP de tentativas de login que falharam.',
    },
    {
      title: 'Como Usamos seus Dados',
      text: 'Seus dados são usados para: fornecer e melhorar o serviço; calcular progresso, pontos e rankings; proteger o serviço contra fraude, trapaça e acessos indevidos; registrar o seu aceite dos Termos e da Política de Privacidade; exibir anúncios, quando estiverem ativos.',
    },
    {
      title: 'Compartilhamento de Dados',
      text: 'Não vendemos seus dados pessoais. Seu nome de usuário, pontuação e quantidade de desafios resolvidos aparecem nos rankings; seu e-mail nunca é exibido. Compartilhamos dados apenas com provedores de serviço essenciais (hospedagem e banco de dados, que podem estar fora do Brasil) e quando exigido por lei. Se os anúncios estiverem ativos, o Google AdSense recebe dados técnicos do seu navegador (como IP e identificadores) para exibi-los, conforme a sua escolha de personalização.',
    },
    {
      title: 'Cookies e Armazenamento Local',
      text: 'Utilizamos um cookie de sessão estritamente necessário para autenticação (inacessível a scripts) e arquivos em cache no aparelho para o app carregar mais rápido e funcionar instalado. Se os anúncios estiverem ativos, o Google AdSense e seus parceiros podem usar cookies e identificadores para exibir e medir anúncios; só os carregamos depois da sua escolha no aviso de anúncios (personalizados ou limitados), que você pode mudar no Perfil. Fora isso, não utilizamos cookies de rastreamento.',
    },
    {
      title: 'Segurança',
      text: 'As senhas são armazenadas com criptografia bcrypt. A comunicação é protegida por HTTPS, as tentativas de login são limitadas e as partidas são validadas no servidor. Nenhum sistema é totalmente seguro; em caso de incidente relevante, avisaremos você e a autoridade competente conforme a lei.',
    },
    {
      title: 'Seus Direitos',
      text: 'Você tem direito a: acessar seus dados; corrigir informações incorretas (o nome de usuário você altera no Perfil); solicitar a exclusão completa da sua conta e dados; portabilidade dos seus dados. Para exercer esses direitos, entre em contato pelo suporte ou exclua sua conta diretamente no Perfil.',
    },
    {
      title: 'Retenção de Dados',
      text: 'Mantemos seus dados enquanto sua conta estiver ativa. Ao excluir a conta pelo Perfil, os dados são removidos imediatamente do nosso banco de dados; cópias de segurança dos provedores podem levar até 30 dias para expirar, e mantemos apenas o que a lei exigir.',
    },
    {
      title: 'Menores de Idade',
      text: 'O serviço não é direcionado a menores de 13 anos e não coletamos intencionalmente dados de crianças abaixo dessa idade. Usuários de 13 a 17 anos devem usá-lo com ciência de um responsável legal.',
    },
    {
      title: 'Alterações nesta Política',
      text: 'Podemos atualizar esta Política periodicamente. Notificaremos sobre mudanças relevantes por aviso na plataforma e pediremos um novo aceite.',
    },
    {
      title: 'Contato',
      text: `Para questões sobre privacidade, entre em contato pelo e-mail de suporte disponível na plataforma${support}.`,
    },
  ],
};
