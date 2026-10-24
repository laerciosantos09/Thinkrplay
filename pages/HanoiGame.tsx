import React, { useState } from 'react';
import GameShell, { WinPanel } from '../components/GameShell';
import { PlayCtl, usePlay } from '../services/usePlay';
import { disksForLevel, initialPegs, moveDisk } from '../lib/hanoi';

const COLORS = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500', 'bg-cyan-500', 'bg-brand-500', 'bg-fuchsia-500'];

const Board: React.FC<{ ctl: PlayCtl; onMoves: (n: number) => void }> = ({ ctl, onMoves }) => {
  const n = disksForLevel(ctl.level);
  const [pegs, setPegs] = useState(() => initialPegs(n));
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
    onMoves(all.length);
    if (next[2].length === n) ctl.finish({ moves: all });
  };

  return (
    <>
      <p className="text-center text-slate-500 mb-4 text-sm">Leve todos os discos para a última torre. Disco maior nunca fica sobre um menor.</p>
      <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-xl mx-auto">
        {pegs.map((peg, i) => (
          <button
            key={i}
            onClick={() => tap(i)}
            aria-label={`Torre ${i + 1}`}
            className={`relative h-64 rounded-2xl border-2 flex flex-col-reverse items-center pb-2 gap-1 transition-colors
              ${from === i ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
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
      <WinPanel title="Torre completa!" text={`${moves.length} movimentos (mínimo possível: ${2 ** n - 1}).`} ctl={ctl} />
    </>
  );
};

const HanoiGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const ctl = usePlay('hanoi');
  const [moves, setMoves] = useState(0);
  return (
    <GameShell title="Torre de Hanói" slug="hanoi" ctl={ctl} onBack={onBack} stats={`${moves} movimentos · mínimo ${2 ** disksForLevel(ctl.level) - 1}`}>
      {ctl.play && <Board key={ctl.play.playId} ctl={ctl} onMoves={setMoves} />}
    </GameShell>
  );
};

export default HanoiGame;
