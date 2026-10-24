import { LEGAL_VERSION } from '../../lib/legal.js';

// Dados do usuário que podem ir para o navegador (nunca hashes).
export const publicUser = (row: Record<string, any>) => ({
  id: row.id as string,
  username: row.username as string,
  email: row.email as string,
  role: row.role as string,
  createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  needsTerms: row.terms_version !== LEGAL_VERSION,
});

export const USER_COLUMNS = 'id, username, email, role, created_at, terms_version';
