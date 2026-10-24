import React, { useEffect, useMemo, useState } from 'react';
import GameShell, { WinPanel } from '../components/GameShell';
import { PlayCtl, usePlay } from '../services/usePlay';
import { canPlace, generateSudoku } from '../lib/sudoku';
import { mulberry32 } from '../lib/rng';

const Board: React.FC<{ ctl: PlayCtl; seed: number }> = ({ ctl, seed }) => {
  const { level } = ctl;
  const { puzzle, solution } = useMemo(() => generateSudoku(mulberry32(seed), level), [seed, level]);
  const [board, setBoard] = useState<number[][]>(() => puzzle.map((r) => [...r]));
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const done = ctl.result !== null;

  const isConflict = (r: number, c: number) => {
    const v = board[r][c];
    if (!v) return false;
    const copy = board.map((row) => [...row]);
    copy[r][c] = 0;
    return !canPlace(copy, r, c, v);
  };

  const input = (n: number) => {
    if (!selected || done) return;
    const [r, c] = selected;
    if (puzzle[r][c]) return;
    const next = board.map((row) => [...row]);
    next[r][c] = n;
    setBoard(next);
    // O servidor refaz o puzzle e confere o tabuleiro final.
    if (next.every((row, i) => row.every((v, j) => v === solution[i][j]))) ctl.finish({ board: next });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[1-9]$/.test(e.key)) input(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') input(0);
      else if (selected && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        const [dr, dc] = d[e.key] ?? [0, 0];
        setSelected([Math.min(8, Math.max(0, selected[0] + dr)), Math.min(8, Math.max(0, selected[1] + dc))]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <div className="grid grid-cols-9 border-2 border-ink-800 mb-6 max-w-[480px] mx-auto aspect-square touch-manipulation">
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
                  ${given ? 'text-ink-800 bg-slate-50' : isConflict(r, c) ? 'text-red-600' : 'text-brand-600'}
                  ${sel ? '!bg-brand-200' : related ? 'bg-brand-50' : ''}
                  ${r % 3 === 0 && r !== 0 ? 'border-t-2 border-t-ink-800' : ''}
                  ${c % 3 === 0 && c !== 0 ? 'border-l-2 border-l-ink-800' : ''}`}
              >
                {cell || ''}
              </button>
            );
          }),
        )}
      </div>
      <div className="grid grid-cols-5 gap-2 max-w-[480px] mx-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
          <button key={n} onClick={() => input(n)} className="h-12 bg-ink-800 text-white rounded-xl font-bold hover:bg-brand-600 active:scale-95">
            {n === 0 ? '⌫' : n}
          </button>
        ))}
      </div>
      <WinPanel title={`Nível ${level} concluído!`} text="Sudoku resolvido." ctl={ctl} />
    </>
  );
};

const SudokuGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const ctl = usePlay('sudoku');
  return (
    <GameShell title="Sudoku" slug="sudoku" ctl={ctl} onBack={onBack}>
      {ctl.play && <Board key={ctl.play.playId} ctl={ctl} seed={ctl.play.seed!} />}
    </GameShell>
  );
};

export default SudokuGame;
