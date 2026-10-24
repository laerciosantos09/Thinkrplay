import { useCallback, useEffect, useState } from 'react';
import { PlayResult, StartedPlay, fetchProgress, finishPlay, guessPlay, startPlay } from './api';

// Ciclo de uma partida validada pelo servidor: iniciar -> jogar -> enviar prova/palpites -> pontos.
export const usePlay = (slug: string) => {
  const [level, setLevel] = useState(1);
  const [unlocked, setUnlocked] = useState(1);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [play, setPlay] = useState<StartedPlay | null>(null);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rankingKey, setRankingKey] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchProgress()
      .then((p) => {
        if (!alive) return;
        const next = p[slug] ?? 1;
        setUnlocked(next);
        setLevel(next);
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
    startPlay(slug, level)
      .then((p) => alive && setPlay(p))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [slug, level, attempt, ready]);

  const applyResult = useCallback((r: PlayResult) => {
    setResult(r);
    setUnlocked((u) => Math.max(u, r.unlocked));
    setRankingKey((k) => k + 1);
  }, []);

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

  // Para jogos com segredo no servidor. Se a resposta trouxer `points`, a partida acabou.
  const guess = useCallback(
    async <T extends { points?: number; unlocked?: number }>(body: Record<string, unknown>) => {
      if (!play) throw new Error('Partida não iniciada.');
      const data = await guessPlay<T>(play.playId, body);
      if (data.points !== undefined && data.unlocked !== undefined) {
        applyResult({ points: data.points, unlocked: data.unlocked });
      }
      return data;
    },
    [play, applyResult],
  );

  return {
    level, setLevel, unlocked, play, result, error, rankingKey,
    restart: () => setAttempt((a) => a + 1),
    finish, guess,
  };
};

export type PlayCtl = ReturnType<typeof usePlay>;
