import { HttpError, sql } from '../_lib/db.js';
import { GAME_SLUGS, requireSession, route } from '../_lib/http.js';
import { assertGameEnabled, isAppSettingEnabled } from '../_lib/games.js';
import { consumeEnergy, energyState, refundEnergy } from '../_lib/energy.js';
import { getSubscription, isSubscriptionActive } from '../_lib/premium.js';
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

  await assertGameEnabled(game);
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

  // Limite de partidas (quando ligado pelo admin): iniciar gasta 1; sem partidas, recusa e informa quando volta a próxima.
  let energyOn = false;
  let premium = false;
  if (await isAppSettingEnabled('energy')) {
    energyOn = true;
    premium = isSubscriptionActive(await getSubscription(session.id));
    if (!(await consumeEnergy(session.id, premium))) {
      const energy = await energyState(session.id, premium);
      throw new HttpError(429, 'Você ficou sem partidas por agora. Aguarde a recarga para jogar de novo.', false, { energy });
    }
  }

  // Código Secreto: a semente é da FAIXA de desafios (permite códigos sem repetição); os demais, do desafio.
  const seed = challengeSeed(game, tier, game === 'mastermind' ? blockStart(tier, challenge) : challenge);
  let playId: string;
  try {
    const rows = await sql`
      INSERT INTO plays (user_id, game, tier, level, seed) VALUES (${session.id}, ${game}, ${tier}, ${challenge}, ${seed})
      RETURNING id`;
    playId = rows[0].id as string;
  } catch (err) {
    if (energyOn) await refundEnergy(session.id, premium).catch(() => {}); // a partida não existiu: devolve a partida gasta
    throw err;
  }
  const energy = energyOn ? await energyState(session.id, premium) : null;
  const base = { playId, tier, challenge, scored: challenge === progress[tier] + 1, energy };

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
