import { HttpError, sql } from '../_lib/db.js';
import { GAME_SLUGS, requireSession, route } from '../_lib/http.js';
import { loadProgress } from '../_lib/play.js';
import { challengeSeed } from '../_lib/seed.js';
import { generateSequence } from '../../lib/sequence.js';
import { blockStart } from '../../lib/mastermind.js';
import { mulberry32 } from '../../lib/rng.js';
import { SEQUENCE_ROUNDS, sequenceSeed } from '../../lib/rounds.js';
import { CHALLENGES_PER_TIER, UNLOCK_RULES, isTier, isTierUnlocked, maxChallenge } from '../../lib/tiers.js';

const MAX_STARTS_PER_HOUR = 200;

export default route(['POST'], async (req) => {
  const session = await requireSession(req);
  const { game, tier, challenge } = req.body ?? {};
  if (typeof game !== 'string' || !GAME_SLUGS.includes(game)) throw new HttpError(400, 'Jogo inválido.');
  if (!isTier(tier)) throw new HttpError(400, 'Nível inválido.');
  if (!Number.isInteger(challenge) || challenge < 1 || challenge > CHALLENGES_PER_TIER) {
    throw new HttpError(400, 'Desafio inválido.');
  }

  const [progress, recent] = await Promise.all([
    loadProgress(session.id, game),
    sql`SELECT count(*)::int AS n FROM plays WHERE user_id = ${session.id} AND started_at > now() - interval '1 hour'`,
  ]);
  if (!isTierUnlocked(tier, progress)) {
    const rule = UNLOCK_RULES[tier]!;
    throw new HttpError(403, `Resolva ${rule.needed} desafios no ${rule.from} para liberar o ${tier}.`);
  }
  if (challenge > maxChallenge(tier, progress)) throw new HttpError(403, 'Desafio ainda bloqueado.');
  if (recent[0].n >= MAX_STARTS_PER_HOUR) throw new HttpError(429, 'Muitas partidas em pouco tempo. Faça uma pausa.');

  // Código Secreto: a semente é da FAIXA de desafios (permite códigos sem repetição); os demais, do desafio.
  const seed = challengeSeed(game, tier, game === 'mastermind' ? blockStart(tier, challenge) : challenge);
  const rows = await sql`
    INSERT INTO plays (user_id, game, tier, level, seed) VALUES (${session.id}, ${game}, ${tier}, ${challenge}, ${seed})
    RETURNING id`;
  const playId = rows[0].id as string;
  const base = { playId, tier, challenge, scored: challenge === progress[tier] + 1 };

  // Jogos com segredo (sequence, mastermind) nunca expõem a semente ao cliente.
  if (game === 'sequence') {
    const puzzles = Array.from({ length: SEQUENCE_ROUNDS }, (_, i) => {
      const p = generateSequence(mulberry32(sequenceSeed(seed, i)), tier, challenge);
      return { shown: p.shown, options: p.options, hint: p.hint };
    });
    return { ...base, puzzles };
  }
  if (game === 'mastermind') return base;
  return { ...base, seed };
});
