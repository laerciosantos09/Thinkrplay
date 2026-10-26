import { PRIVACY_VERSION, TERMS_VERSION } from '../../lib/legal.js';

// Aceite dos documentos legais (flags). Sem a coluna privacy_version (migração 010 pendente), a privacidade acompanha os termos.
export const legalFlags = (row: Record<string, any>) => {
  const termsAccepted = row.terms_version === TERMS_VERSION;
  const privacyAccepted = 'privacy_version' in row ? row.privacy_version === PRIVACY_VERSION : termsAccepted;
  return { termsAccepted, privacyAccepted, accepted: termsAccepted && privacyAccepted };
};

// Contas criadas com a confirmação de e-mail ligada ficam barradas até confirmar (contas antigas não).
export const needsEmailVerification = (row: Record<string, any>) => row.verification_required === true && row.email_verified !== true;

// Dados do usuário que podem ir para o navegador (nunca hashes).
export const publicUser = (row: Record<string, any>) => ({
  id: row.id as string,
  username: row.username as string,
  email: row.email as string,
  role: row.role as string,
  createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  signupMethod: (row.signup_method as string | undefined) ?? 'password', // por onde a conta foi criada
  termsAccepted: legalFlags(row).termsAccepted,
  privacyAccepted: legalFlags(row).privacyAccepted,
  emailVerified: row.email_verified === true,
  needsEmailVerification: needsEmailVerification(row),
  needsTerms: !legalFlags(row).accepted,
});

export const USER_COLUMNS = 'id, username, email, role, created_at, terms_version';
