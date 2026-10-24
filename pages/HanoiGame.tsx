import React, { useMemo, useState } from 'react';
import GameShell, { WinPanel } from '../components/GameShell';
import { PlayCtl, usePlay } from '../services/usePlay';
import { generateHanoi, isGoal, moveDisk } from '../lib/hanoi';
import { mulberry32 } from '../lib/rng';

const COLORS = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-fuchsia-500'];

const Board: React.FC<{ ctl: PlayCtl; seed: number; onMoves: (n: number, optimal: number) => void }> = ({ ctl, seed, onMoves }) => {
  const puzzle = useMemo(() => generateHanoi(mulberry32(seed), ctl.tier, ctl.challenge), [seed, ctl.tier, ctl.challenge]);
  const n = puzzle.disks;
  const [pegs, setPegs] = useState(puzzle.pegs);
  const [from, setFrom] = useState<number | null>(null);
  const [moves, setMoves] = useState<[number, number][]>([]);

  const tap = (i: number) => {
    if (ctl.result) return;
    if (from === null) {
      if (pegs[i].length) setFrom(i);
      return;
    }
    if (from === i) return setFrom(null);
    const next = moveDisk(pegs, from, i);
    setFrom(null);
    if (!next) return;
    const all: [number, number][] = [...moves, [from, i]];
    setPegs(next);
    setMoves(all);
    onMoves(all.length, puzzle.optimal);
    if (isGoal(next, puzzle.goal, n)) ctl.finish({ moves: all });
  };

  return (
    <>
      <p className="text-center text-slate-500 mb-4 text-sm">
        Leve todos os {n} discos para a torre marcada com ⚑. Disco maior nunca fica sobre um menor.
      </p>
      <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-xl mx-auto">
        {pegs.map((peg, i) => (
          <button
            key={i}
            onClick={() => tap(i)}
            aria-label={`Torre ${i + 1}${i === puzzle.goal ? ' (destino)' : ''}`}
            className={`relative h-64 rounded-2xl border-2 flex flex-col-reverse items-center pb-2 gap-1 transition-colors
              ${from === i ? 'border-brand-500 bg-brand-50' : i === puzzle.goal ? 'border-mint-400 bg-mint-300/10' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
          >
            {i === puzzle.goal && <span className="absolute top-1 text-xs font-black text-mint-500">⚑ destino</span>}
            <span className="absolute bottom-2 top-6 w-2 bg-slate-300 rounded-full -z-0" />
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
      <WinPanel title="Torre completa!" text={`${moves.length} movimentos (mínimo possível: ${puzzle.optimal}).`} ctl={ctl} />
    </>
  );
};

const HanoiGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const ctl = usePlay('hanoi');
  const [stats, setStats] = useState('');
  return (
    <GameShell title="Torre de Hanói" slug="hanoi" ctl={ctl} onBack={onBack} stats={stats}>
      {ctl.play && (
        <Board key={ctl.play.playId} ctl={ctl} seed={ctl.play.seed!} onMoves={(n, opt) => setStats(`${n} movimentos · mínimo ${opt}`)} />
      )}
    </GameShell>
  );
};

export default HanoiGame;
