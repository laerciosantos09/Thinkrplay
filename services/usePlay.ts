import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, PlayResult, StartedPlay, fetchProgress, finishPlay, guessPlay, startPlay } from './api';
import {
  Tier, TierProgress, TIERS, emptyProgress, highestUnlocked, isTierUnlocked, maxChallenge,
} from '../lib/tiers';
import { useEnergy } from '../components/energy/EnergyContext';

export interface PlayOutcome extends PlayResult {
  unlockedTier: Tier | null; // nível liberado por esta vitória
}

// Ciclo de uma partida validada pelo servidor: escolher o desafio -> JOGAR (gasta 1 partida, se houver limite)
// -> enviar prova/palpites -> pontos. Navegar entre desafios e níveis NÃO inicia partida nem gasta nada.
export const usePlay = (slug: string) => {
  const [progress, setProgress] = useState<TierProgress>(emptyProgress());
  const [tier, setTier] = useState<Tier>('easy');
  const [challenge, setChallengeState] = useState(1);
  const [ready, setReady] = useState(false);
  const [startRequest, setStartRequest] = useState<number | null>(null); // null = só vendo o desafio
  const [play, setPlay] = useState<StartedPlay | null>(null);
  const [result, setResult] = useState<PlayOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rankingKey, setRankingKey] = useState(0);
  const { setState: setEnergy } = useEnergy();
  const latest = useRef({ tier, challenge });
  latest.current = { tier, challenge };

  // Abre no nível mais alto liberado, no próximo desafio pendente (sem iniciar partida).
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
    if (!ready || startRequest === null) return;
    let alive = true;
    setPlay(null);
    setResult(null);
    setError(null);
    startPlay(slug, latest.current.tier, latest.current.challenge)
      .then((p) => {
        if (!alive) return;
        if (p.energy) setEnergy(p.energy);
        setPlay(p);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
        const energy = (e as ApiError).data?.energy; // sem partidas: o servidor diz quando volta a próxima
        if (energy) setEnergy(energy);
      });
    return () => {
      alive = false;
    };
  }, [slug, startRequest, ready, setEnergy]);

  const idle = startRequest === null;
  const starting = !idle && !play && !error;

  const resetView = () => {
    setPlay(null);
    setResult(null);
    setError(null);
    setStartRequest(null);
  };

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
    resetView();
    setTier(next);
    setChallengeState(maxChallenge(next, progress));
  };

  // Troca o desafio visto. Com `play`, já inicia a partida (botões "Próximo desafio"); sem, só mostra o desafio.
  const setChallenge = (n: number, options: { play?: boolean } = {}) => {
    const limit = maxChallenge(tier, progress);
    setChallengeState(Math.min(Math.max(1, Math.round(n) || 1), limit));
    if (options.play) {
      setPlay(null); setResult(null); setError(null);
      setStartRequest((r) => (r ?? 0) + 1);
    } else {
      resetView();
    }
  };

  return {
    slug, tier, challenge, progress, play, result, error, rankingKey, idle, starting,
    nextChallenge: maxChallenge(tier, progress),
    selectTier, setChallenge,
    begin: () => setStartRequest((r) => (r ?? 0) + 1), // clique em "Jogar": gasta 1 partida (se houver limite)
    restart: () => setStartRequest((r) => (r ?? 0) + 1), // "Repetir": nova partida do mesmo desafio
    finish, guess,
  };
};

export type PlayCtl = ReturnType<typeof usePlay>;
