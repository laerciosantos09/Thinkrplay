import React, { useEffect, useMemo, useState } from 'react';
import GameShell, { WinPanel } from '../components/GameShell';
import { useProgress } from '../services/useProgress';
import { generateSequence } from '../lib/sequence';
import { mulberry32, seedFor } from '../lib/rng';

const ROUNDS = 3;

const SequenceGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [level, setLevel] = useState(1);
  const { unlocked, rankingKey, saveError, complete } = useProgress('sequence', setLevel);
  const [attempt, setAttempt] = useState(0);
  const [round, setRound] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [wrong, setWrong] = useState<number[]>([]);
  const [points, setPoints] = useState<number | null>(null);

  const puzzles = useMemo(
    () => Array.from({ length: ROUNDS }, (_, i) =>
      generateSequence(mulberry32(seedFor('sequence', level * 10 + i) + attempt), level)),
    [level, attempt],
  );

  useEffect(() => {
    setRound(0); setMistakes(0); setHints(0); setShowHint(false); setWrong([]); setPoints(null);
  }, [level, attempt]);

  const puzzle = puzzles[Math.min(round, ROUNDS - 1)];

  const answer = (value: number) => {
    if (points !== null) return;
    if (value !== puzzle.answer) {
      setMistakes((m) => m + 1);
      setWrong((w) => [...w, value]);
      return;
    }
    if (round + 1 < ROUNDS) {
      setRound(round + 1);
      setWrong([]);
      setShowHint(false);
      return;
    }
    const earned = Math.max(20, Math.min(4000, 100 + level * 2 - mistakes * 20 - hints * 10));
    setPoints(earned);
    complete(level, earned);
  };

  return (
    <GameShell title="Sequências" slug="sequence" level={level} unlocked={unlocked} onLevel={setLevel} onBack={onBack}
      rankingKey={rankingKey} stats={`Desafio ${Math.min(round + 1, ROUNDS)}/${ROUNDS} · ${mistakes} erros`}>
      <p className="text-center text-slate-500 mb-4">Qual número vem a seguir?</p>
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {puzzle.shown.map((n, i) => (
          <span key={i} className="min-w-[3.25rem] px-3 py-3 bg-slate-100 rounded-xl text-xl font-black text-slate-700 text-center">{n}</span>
        ))}
        <span className="min-w-[3.25rem] px-3 py-3 bg-indigo-100 rounded-xl text-xl font-black text-indigo-500 text-center">?</span>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
        {puzzle.options.map((o) => (
          <button
            key={o}
            disabled={wrong.includes(o)}
            onClick={() => answer(o)}
            className="py-4 rounded-2xl text-2xl font-black bg-slate-800 text-white hover:bg-indigo-600 disabled:bg-red-100 disabled:text-red-400 active:scale-95 transition-all"
          >
            {o}
          </button>
        ))}
      </div>

      <div className="text-center mt-6 min-h-[3rem]">
        {showHint ? (
          <p className="text-amber-700 bg-amber-50 rounded-xl px-4 py-2 inline-block">{puzzle.hint}</p>
        ) : (
          <button onClick={() => { setShowHint(true); setHints((h) => h + 1); }} className="text-sm font-bold text-indigo-600 hover:underline">
            Pedir dica (-10 pontos)
          </button>
        )}
      </div>

      {points !== null && (
        <WinPanel
          title={`Nível ${level} concluído!`}
          text={`${mistakes} erro(s) e ${hints} dica(s).`}
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

export default SequenceGame;
