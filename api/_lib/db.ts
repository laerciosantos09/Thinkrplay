import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;

export const sql = neon(url ?? 'postgres://missing');

export const assertDb = () => {
  if (!url) throw new HttpError(500, 'Banco de dados não configurado (DATABASE_URL).');
};

// `expose`: mensagem 5xx segura para o usuário (ex.: falha do provedor de pagamento). Sem isso, erros 5xx
// mostram só "Erro interno" ao cliente e o detalhe vai para o log.
// `extra`: campos adicionais devolvidos junto com o erro (ex.: estado da energia ao ficar sem partidas).
export class HttpError extends Error {
  constructor(public status: number, message: string, public expose = false, public extra?: Record<string, unknown>) {
    super(message);
  }
}

// Tabela ainda não criada (migração pendente). Recursos opcionais usam isto para degradar em vez de derrubar o app.
export const isMissingTable = (err: unknown) => (err as { code?: string } | null)?.code === '42P01';

export const orIfMissing = async <T>(run: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await run();
  } catch (err) {
    if (isMissingTable(err)) return fallback;
    throw err;
  }
};
