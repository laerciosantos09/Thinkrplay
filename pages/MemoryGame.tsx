import React, { useMemo, useState } from 'react';
import GameShell, { WinPanel } from '../components/GameShell';
import { PlayCtl, usePlay } from '../services/usePlay';
import { buildDeck } from '../lib/memory';

const Board: React.FC<{ ctl: PlayCtl; seed: number; onMoves: (n: number) => void }> = ({ ctl, seed, onMoves }) => {
  const deck = useMemo(() => buildDeck(seed, ctl.level), [seed, ctl.level]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [flips, setFlips] = useState<[number, number][]>([]);

  const flip = (idx: number) => {
    if (open.length === 2 || open.includes(idx) || matched.has(idx) || ctl.result) return;
    const nextOpen = [...open, idx];
    setOpen(nextOpen);
    if (nextOpen.length < 2) return;

    const pair: [number, number] = [nextOpen[0], nextOpen[1]];
    const all = [...flips, pair];
    setFlips(all);
    onMoves(all.length);
    if (deck[pair[0]] === deck[pair[1]]) {
      const done = new Set(matched).add(pair[0]).add(pair[1]);
      setMatched(done);
      setOpen([]);
      if (done.size === deck.length) ctl.finish({ flips: all });
    } else {
      setTimeout(() => setOpen([]), 800);
    }
  };

  return (
    <>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3 max-w-[560px] mx-auto">
        {deck.map((emoji, idx) => {
          const faceUp = open.includes(idx) || matched.has(idx);
          return (
            <button
              key={idx}
              onClick={() => flip(idx)}
              aria-label={faceUp ? emoji : 'Carta virada'}
              className={`aspect-square rounded-2xl text-3xl sm:text-4xl flex items-center justify-center border-2 transition-all
                ${matched.has(idx) ? 'bg-green-50 border-green-200' : faceUp ? 'bg-white border-indigo-300' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
            >
              {faceUp ? emoji : <span className="text-indigo-400/40">?</span>}
            </button>
          );
        })}
      </div>
      <WinPanel title="Excelente memória!" text={`Nível ${ctl.level} concluído em ${flips.length} movimentos.`} ctl={ctl} />
    </>
  );
};

const MemoryGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const ctl = usePlay('memory');
  const [moves, setMoves] = useState(0);
  return (
    <GameShell title="Memória" slug="memory" ctl={ctl} onBack={onBack} stats={`${moves} movimentos`}>
      {ctl.play && <Board key={ctl.play.playId} ctl={ctl} seed={ctl.play.seed!} onMoves={setMoves} />}
    </GameShell>
  );
};

export default MemoryGame;
