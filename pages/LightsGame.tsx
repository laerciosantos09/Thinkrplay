import React, { useEffect, useMemo, useState } from 'react';
import GameShell, { WinPanel } from '../components/GameShell';
import { useProgress } from '../services/useProgress';
import { Board, generateLights, isSolved, press } from '../lib/lights';
import { mulberry32, seedFor } from '../lib/rng';

const LightsGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [level, setLevel] = useState(1);
  const { unlocked, rankingKey, saveError, complete } = useProgress('lights', setLevel);
  const [attempt, setAttempt] = useState(0);
  const initial = useMemo(() => generateLights(mulberry32(seedFor('lights', level)), level), [level]);
  const [board, setBoard] = useState<Board>(initial.board);
  const [moves, setMoves] = useState(0);
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    setBoard(initial.board); setMoves(0); setPoints(null);
  }, [initial, attempt]);

  const tap = (r: number, c: number) => {
    if (points !== null) return;
    const next = press(board, r, c);
    setBoard(next);
    const used = moves + 1;
    setMoves(used);
    if (isSolved(next)) {
      const earned = Math.max(40, Math.min(4000, 100 + level * 2 - Math.max(0, used - initial.par) * 5));
      setPoints(earned);
      complete(level, earned);
    }
  };

  const size = board.length;

  return (
    <GameShell title="Luzes" slug="lights" level={level} unlocked={unlocked} onLevel={setLevel} onBack={onBack}
      rankingKey={rankingKey} stats={`${moves} toques · meta ${initial.par}`}>
      <p className="text-center text-slate-500 mb-4 text-sm">
        Cada toque inverte a luz e as 4 vizinhas. Apague todas.
      </p>
      <div className="grid gap-2 max-w-[420px] mx-auto" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
        {board.map((row, r) =>
          row.map((on, c) => (
            <button
              key={`${r}-${c}`}
              onClick={() => tap(r, c)}
              aria-label={`Luz ${r + 1},${c + 1} ${on ? 'acesa' : 'apagada'}`}
              className={`aspect-square rounded-xl transition-all active:scale-90
                ${on ? 'bg-yellow-300 shadow-[0_0_18px_4px_rgba(253,224,71,0.7)]' : 'bg-slate-800'}`}
            />
          )),
        )}
      </div>

      {points !== null && (
        <WinPanel
          title="Tudo apagado!"
          text={`${moves} toques (meta: ${initial.par}).`}
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

export default LightsGame;
