import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;

export const sql = neon(url ?? 'postgres://missing');

export const assertDb = () => {
  if (!url) throw new HttpError(500, 'Banco de dados não configurado (DATABASE_URL).');
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
