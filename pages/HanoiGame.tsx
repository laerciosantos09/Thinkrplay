import React, { useEffect, useState } from 'react';
import GameShell, { WinPanel } from '../components/GameShell';
import { useProgress } from '../services/useProgress';

const COLORS = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-fuchsia-500'];

const disksForLevel = (level: number) => Math.min(8, 3 + Math.floor((level - 1) / 3));
const initialPegs = (n: number) => [Array.from({ length: n }, (_, i) => n - i), [], []] as number[][];

const HanoiGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [level, setLevel] = useState(1);
  const { unlocked, rankingKey, saveError, complete } = useProgress('hanoi', setLevel);
  const [attempt, setAttempt] = useState(0);
  const n = disksForLevel(level);
  const optimal = 2 ** n - 1;
  const [pegs, setPegs] = useState<number[][]>(initialPegs(n));
  const [from, setFrom] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    setPegs(initialPegs(n)); setFrom(null); setMoves(0); setPoints(null);
  }, [n, level, attempt]);

  const tap = (i: number) => {
    if (points !== null) return;
    if (from === null) {
      if (pegs[i].length) setFrom(i);
      return;
    }
    if (from === i) return setFrom(null);
    const disk = pegs[from][pegs[from].length - 1];
    const top = pegs[i][pegs[i].length - 1];
    if (top !== undefined && top < disk) return setFrom(null);

    const next = pegs.map((p) => [...p]);
    next[from].pop();
    next[i].push(disk);
    setPegs(next);
    setFrom(null);
    const used = moves + 1;
    setMoves(used);
    if (next[2].length === n) {
      const earned = Math.max(50, Math.min(4000, 100 + n * 20 + level - (used - optimal) * 3));
      setPoints(earned);
      complete(level, earned);
    }
  };

  return (
    <GameShell title="Torre de Hanói" slug="hanoi" level={level} unlocked={unlocked} onLevel={setLevel} onBack={onBack}
      rankingKey={rankingKey} stats={`${moves} movimentos · mínimo ${optimal}`}>
      <p className="text-center text-slate-500 mb-4 text-sm">
        Leve todos os discos para a última torre. Disco maior nunca fica sobre um menor.
      </p>
      <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-xl mx-auto">
        {pegs.map((peg, i) => (
          <button
            key={i}
            onClick={() => tap(i)}
            aria-label={`Torre ${i + 1}`}
            className={`relative h-64 rounded-2xl border-2 flex flex-col-reverse items-center pb-2 gap-1 transition-colors
              ${from === i ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
          >
            <span className="absolute bottom-2 top-4 w-2 bg-slate-300 rounded-full -z-0" />
            {peg.map((d, k) => (
              <span
                key={d}
                style={{ width: `${30 + (d / n) * 65}%` }}
                className={`relative h-6 rounded-full ${COLORS[d - 1]} shadow ${from === i && k === peg.length - 1 ? '-translate-y-2' : ''} transition-transform`}
              />
            ))}
          </button>
        ))}
      </div>

      {points !== null && (
        <WinPanel
          title="Torre completa!"
          text={`${moves} movimentos (mínimo possível: ${optimal}).`}
          points={points}
          saveError={saveError}
          canAdvance={level < unlocked}
          onNext={() => setLevel(level + 1)}
          onRetry={() => setAttempt((a) => a + 1)}
        />
      )}
    </GameShell>
  );
};

export default HanoiGame;
