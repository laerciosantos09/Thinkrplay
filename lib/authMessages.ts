// Mensagens do retorno do login social (/?auth_error=... e /?auth_notice=...).
export const AUTH_ERRORS: Record<string, string> = {
  unavailable: 'Este tipo de login não está disponível no momento.',
  state: 'O login expirou ou foi interrompido. Tente novamente.',
  cancelled: 'Login cancelado.',
  failed: 'Não foi possível validar o login. Tente novamente.',
  unverified_email: 'O e-mail dessa conta não está verificado. Verifique-o no provedor e tente de novo.',
  email_in_use: 'Já existe uma conta com este e-mail. Entre com seu e-mail e senha e conecte o Google/Apple em Meu perfil.',
  session: 'Sua sessão expirou. Entre novamente e tente conectar a conta.',
  identity_in_use: 'Esta conta Google/Apple já está conectada a outro usuário.',
  already_linked: 'Você já conectou uma conta deste provedor.',
};
export const AUTH_NOTICES: Record<string, string> = {
  linked_google: 'Conta Google conectada.',
  linked_apple: 'Conta Apple conectada.',
};
