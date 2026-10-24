import { useCallback, useEffect, useState } from 'react';
import { fetchProgress, submitScore } from './api';

// Nível liberado do usuário em um jogo + envio de pontuação ao concluir um nível.
export const useProgress = (slug: string, onLoaded?: (level: number) => void) => {
  const [unlocked, setUnlocked] = useState(1);
  const [rankingKey, setRankingKey] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchProgress()
      .then((p) => {
        if (!alive) return;
        const level = p[slug] ?? 1;
        setUnlocked(level);
        onLoaded?.(level);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const complete = useCallback(
    async (level: number, points: number) => {
      setSaveError(null);
      try {
        const res = await submitScore(slug, level, points);
        setUnlocked((u) => Math.max(u, res.unlocked));
        setRankingKey((k) => k + 1);
      } catch (e) {
        // Mesmo sem salvar, deixa seguir para o próximo nível localmente.
        setUnlocked((u) => Math.max(u, level + 1));
        setSaveError(e instanceof Error ? e.message : 'Não foi possível salvar a pontuação.');
      }
    },
    [slug],
  );

  return { unlocked, rankingKey, saveError, complete };
};
