import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;

export const sql = neon(url ?? 'postgres://missing');

export const assertDb = () => {
  if (!url) throw new HttpError(500, 'Banco de dados não configurado (DATABASE_URL).');
};

// `expose`: mensagem 5xx segura para o usuário (ex.: falha do provedor de pagamento). Sem isso, erros 5xx
// mostram só "Erro interno" ao cliente e o detalhe vai para o log.
export class HttpError extends Error {
  constructor(public status: number, message: string, public expose = false) {
    super(message);
  }
}
