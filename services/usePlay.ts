import { useCallback, useEffect, useState } from 'react';
import { PlayResult, StartedPlay, fetchProgress, finishPlay, guessPlay, startPlay } from './api';
import {
  Tier, TierProgress, TIERS, emptyProgress, highestUnlocked, isTierUnlocked, maxChallenge,
} from '../lib/tiers';

export interface PlayOutcome extends PlayResult {
  unlockedTier: Tier | null; // nível liberado por esta vitória
}

// Ciclo de uma partida validada pelo servidor: iniciar -> jogar -> enviar prova/palpites -> pontos.
export const usePlay = (slug: string) => {
  const [progress, setProgress] = useState<TierProgress>(emptyProgress());
  const [tier, setTier] = useState<Tier>('easy');
  const [challenge, setChallengeState] = useState(1);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [play, setPlay] = useState<StartedPlay | null>(null);
  const [result, setResult] = useState<PlayOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rankingKey, setRankingKey] = useState(0);

  // Abre no nível mais alto liberado, no próximo desafio pendente.
  useEffect(() => {
    let alive = true;
    fetchProgress()
      .then((all) => {
        if (!alive) return;
        const p = { ...emptyProgress(), ...(all[slug] ?? {}) };
        const t = highestUnlocked(p);
        setProgress(p);
        setTier(t);
        setChallengeState(maxChallenge(t, p));
      })
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    setPlay(null);
    setResult(null);
    setError(null);
    startPlay(slug, tier, challenge)
      .then((p) => alive && setPlay(p))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [slug, tier, challenge, attempt, ready]);

  const applyResult = useCallback(
    (r: PlayResult) => {
      const unlockedTier = TIERS.find((t) => !isTierUnlocked(t, progress) && isTierUnlocked(t, r.progress)) ?? null;
      setProgress(r.progress);
      setResult({ ...r, unlockedTier });
      setRankingKey((k) => k + 1);
    },
    [progress],
  );

  const finish = useCallback(
    async (proof: unknown) => {
      if (!play) return;
      try {
        applyResult(await finishPlay(play.playId, proof));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Não foi possível validar a partida.');
      }
    },
    [play, applyResult],
  );

  // Para jogos com segredo no servidor. Se a resposta trouxer `progress`, a partida acabou.
  const guess = useCallback(
    async <T extends { points?: number; awarded?: boolean; progress?: TierProgress }>(body: Record<string, unknown>) => {
      if (!play) throw new Error('Partida não iniciada.');
      const data = await guessPlay<T>(play.playId, body);
      if (data.progress && data.points !== undefined && data.awarded !== undefined) {
        applyResult({ points: data.points, awarded: data.awarded, progress: data.progress });
      }
      return data;
    },
    [play, applyResult],
  );

  const selectTier = (next: Tier) => {
    if (!isTierUnlocked(next, progress)) return;
    setTier(next);
    setChallengeState(maxChallenge(next, progress));
  };

  const setChallenge = (n: number) => {
    const limit = maxChallenge(tier, progress);
    setChallengeState(Math.min(Math.max(1, Math.round(n) || 1), limit));
  };

  return {
    slug, tier, challenge, progress, play, result, error, rankingKey,
    nextChallenge: maxChallenge(tier, progress),
    selectTier, setChallenge,
    restart: () => setAttempt((a) => a + 1),
    finish, guess,
  };
};

export type PlayCtl = ReturnType<typeof usePlay>;
