// Versões dos Termos de Uso e da Política de Privacidade (cada documento tem a sua). Ao mudar o texto de um deles de
// forma relevante, altere a versão: todos os usuários passam a ver o aceite daquele documento na próxima visita.
export const TERMS_VERSION = '2026-10-25.1';
export const PRIVACY_VERSION = '2026-10-25.1';
export const LEGAL_UPDATED_LABEL = 'outubro de 2026';

// Reservados: evitam se passar pela equipe do app. Administradores (criados por script) não são afetados.
export const RESERVED_USERNAMES = ['admin', 'administrador', 'administrator', 'root', 'suporte', 'support', 'moderador', 'thinkrplay', 'thinkr'];

// Regras do nome de usuário (únicas, sem diferenciar maiúsculas): 3 a 24 letras, números, _ . ou -
export const USERNAME_PATTERN = /^[\p{L}\p{N}_.-]{3,24}$/u;
