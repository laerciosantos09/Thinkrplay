import React, { useEffect, useMemo, useRef, useState } from 'react';
import GameShell, { WinPanel } from '../components/GameShell';
import { useProgress } from '../services/useProgress';
import { generateSudoku, canPlace } from '../lib/sudoku';
import { mulberry32, seedFor } from '../lib/rng';

const SudokuGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [level, setLevel] = useState(1);
  const { unlocked, rankingKey, saveError, complete } = useProgress('sudoku', setLevel);
  const [attempt, setAttempt] = useState(0);
  const { puzzle, solution } = useMemo(
    () => generateSudoku(mulberry32(seedFor('sudoku', level)), level),
    [level],
  );
  const [board, setBoard] = useState<number[][]>(puzzle);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    setBoard(puzzle.map((r) => [...r]));
    setSelected(null);
    setPoints(null);
    startedAt.current = Date.now();
  }, [puzzle, attempt]);

  const isConflict = (r: number, c: number) => {
    const v = board[r][c];
    if (!v) return false;
    const copy = board.map((row) => [...row]);
    copy[r][c] = 0;
    return !canPlace(copy, r, c, v);
  };

  const input = (n: number) => {
    if (!selected || points !== null) return;
    const [r, c] = selected;
    if (puzzle[r][c]) return;
    const next = board.map((row) => [...row]);
    next[r][c] = n;
    setBoard(next);
    if (next.every((row, i) => row.every((v, j) => v === solution[i][j]))) {
      const secs = (Date.now() - startedAt.current) / 1000;
      const earned = Math.max(50, Math.min(4000, 200 + level * 3 - Math.floor(secs / 5)));
      setPoints(earned);
      complete(level, earned);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[1-9]$/.test(e.key)) input(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') input(0);
      else if (selected && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const [r, c] = selected;
        const d: Record<string, [number, number]> = {
          ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
        };
        const [dr, dc] = d[e.key] ?? [0, 0];
        setSelected([Math.min(8, Math.max(0, r + dr)), Math.min(8, Math.max(0, c + dc))]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <GameShell title="Sudoku" slug="sudoku" level={level} unlocked={unlocked} onLevel={setLevel} onBack={onBack} rankingKey={rankingKey}>
      <div className="grid grid-cols-9 border-2 border-slate-800 mb-6 max-w-[480px] mx-auto aspect-square touch-manipulation">
        {board.map((row, r) =>
          row.map((cell, c) => {
            const given = puzzle[r][c] !== 0;
            const sel = selected?.[0] === r && selected?.[1] === c;
            const related = selected && !sel && (selected[0] === r || selected[1] === c);
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => setSelected([r, c])}
                className={`flex items-center justify-center text-lg sm:text-xl font-bold aspect-square border border-slate-200
                  ${given ? 'text-slate-800 bg-slate-50' : isConflict(r, c) ? 'text-red-600' : 'text-indigo-600'}
                  ${sel ? '!bg-indigo-200' : related ? 'bg-indigo-50' : ''}
                  ${r % 3 === 0 && r !== 0 ? 'border-t-2 border-t-slate-800' : ''}
                  ${c % 3 === 0 && c !== 0 ? 'border-l-2 border-l-slate-800' : ''}`}
              >
                {cell || ''}
              </button>
            );
          }),
        )}
      </div>

      <div className="grid grid-cols-5 gap-2 max-w-[480px] mx-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
          <button
            key={n}
            onClick={() => input(n)}
            className="h-12 bg-slate-800 text-white rounded-xl font-bold hover:bg-indigo-600 active:scale-95"
          >
            {n === 0 ? '⌫' : n}
          </button>
        ))}
      </div>

      {points !== null && (
        <WinPanel
          title={`Nível ${level} concluído!`}
          text="Sudoku resolvido sem erros."
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

export default SudokuGame;
