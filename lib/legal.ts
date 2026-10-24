// Versão dos Termos de Uso e da Política de Privacidade. Ao mudar o texto de forma relevante, altere esta versão:
// todos os usuários passam a ver a tela de aceite na próxima visita.
export const LEGAL_VERSION = '2026-10-24.5';
export const LEGAL_UPDATED_LABEL = 'outubro de 2026';

// Reservados: evitam se passar pela equipe do app. Administradores (criados por script) não são afetados.
export const RESERVED_USERNAMES = ['admin', 'administrador', 'administrator', 'root', 'suporte', 'support', 'moderador', 'thinkrplay', 'thinkr'];

// Regras do nome de usuário (únicas, sem diferenciar maiúsculas): 3 a 24 letras, números, _ . ou -
export const USERNAME_PATTERN = /^[\p{L}\p{N}_.-]{3,24}$/u;
