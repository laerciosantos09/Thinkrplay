import { createHmac } from 'node:crypto';
import { HttpError } from './db.js';

// Cada desafio (jogo + tier + número) tem uma semente fixa, mas impossível de prever sem o segredo do servidor.
// Use CHALLENGE_SECRET para isolar dos tokens; sem ela usa JWT_SECRET. Trocar o segredo muda os puzzles
// (o progresso dos usuários continua valendo, pois conta desafios resolvidos, não puzzles específicos).
const secret = () => {
  const value = process.env.CHALLENGE_SECRET ?? process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new HttpError(500, 'Segredo dos desafios não configurado.');
  return value;
};

export const challengeSeed = (game: string, tier: string, challenge: number) =>
  createHmac('sha256', secret()).update(`${game}:${tier}:${challenge}`).digest().readUInt32BE(0) & 0x7fffffff;
