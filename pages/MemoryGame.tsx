import React, { useEffect, useState } from 'react';
import GameShell, { WinPanel } from '../components/GameShell';
import { useProgress } from '../services/useProgress';
import { mulberry32, seedFor, shuffle } from '../lib/rng';

const EMOJIS = ['🚀', '🍕', '🎸', '⚽', '🕹️', '🎨', '🦁', '🌙', '🌊', '🔥', '💎', '🍒', '🎭', '🚲', '🍔', '🍦'];

const pairsForLevel = (level: number) => Math.min(12, 3 + Math.ceil(level / 4));

const MemoryGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [level, setLevel] = useState(1);
  const { unlocked, rankingKey, saveError, complete } = useProgress('memory', setLevel);
  const [attempt, setAttempt] = useState(0);
  const [cards, setCards] = useState<string[]>([]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [points, setPoints] = useState<number | null>(null);
  const pairs = pairsForLevel(level);

  useEffect(() => {
    const rng = mulberry32(seedFor('memory', level) + attempt);
    const chosen = shuffle(EMOJIS, rng).slice(0, pairs);
    setCards(shuffle([...chosen, ...chosen], rng));
    setOpen([]);
    setMatched(new Set());
    setMoves(0);
    setPoints(null);
  }, [level, attempt, pairs]);

  const flip = (idx: number) => {
    if (open.length === 2 || open.includes(idx) || matched.has(idx) || points !== null) return;
    const nextOpen = [...open, idx];
    setOpen(nextOpen);
    if (nextOpen.length < 2) return;

    const used = moves + 1;
    setMoves(used);
    const [a, b] = nextOpen;
    if (cards[a] === cards[b]) {
      const done = new Set(matched).add(a).add(b);
      setMatched(done);
      setOpen([]);
      if (done.size === cards.length) {
        const earned = Math.max(50, Math.min(4000, 150 + level * 2 - (used - pairs) * 8));
        setPoints(earned);
        complete(level, earned);
      }
    } else {
      setTimeout(() => setOpen([]), 800);
    }
  };

  return (
    <GameShell title="Memória" slug="memory" level={level} unlocked={unlocked} onLevel={setLevel} onBack={onBack}
      rankingKey={rankingKey} stats={`${moves} movimentos · ${pairs} pares`}>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3 max-w-[560px] mx-auto">
        {cards.map((emoji, idx) => {
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

      {points !== null && (
        <WinPanel
          title="Excelente memória!"
          text={`Nível ${level} em ${moves} movimentos.`}
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

export default MemoryGame;
