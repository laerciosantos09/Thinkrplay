import React, { useEffect, useMemo, useState } from 'react';
import GameShell, { WinPanel } from '../components/GameShell';
import { useProgress } from '../services/useProgress';
import { PALETTE, configForLevel, evaluate, generateCode } from '../lib/mastermind';
import { mulberry32, seedFor } from '../lib/rng';

interface Guess { colors: number[]; exact: number; partial: number }

const MastermindGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [level, setLevel] = useState(1);
  const { unlocked, rankingKey, saveError, complete } = useProgress('mastermind', setLevel);
  const [attempt, setAttempt] = useState(0);
  const cfg = configForLevel(level);
  const code = useMemo(() => generateCode(mulberry32(seedFor('mastermind', level) + attempt), level), [level, attempt]);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [current, setCurrent] = useState<(number | null)[]>(Array(cfg.length).fill(null));
  const [points, setPoints] = useState<number | null>(null);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    setGuesses([]); setCurrent(Array(cfg.length).fill(null)); setPoints(null); setLost(false);
  }, [code, cfg.length]);

  const pick = (color: number) => {
    const slot = current.indexOf(null);
    if (slot >= 0) setCurrent(current.map((v, i) => (i === slot ? color : v)));
  };

  const submit = () => {
    if (current.includes(null)) return;
    const colors = current as number[];
    const result = evaluate(code, colors);
    const next = [...guesses, { colors, ...result }];
    setGuesses(next);
    setCurrent(Array(cfg.length).fill(null));
    if (result.exact === cfg.length) {
      const earned = Math.max(50, Math.min(4000, 100 + level * 2 + (cfg.attempts - next.length) * 15));
      setPoints(earned);
      complete(level, earned);
    } else if (next.length >= cfg.attempts) {
      setLost(true);
    }
  };

  const over = points !== null || lost;

  return (
    <GameShell title="Código Secreto" slug="mastermind" level={level} unlocked={unlocked} onLevel={setLevel} onBack={onBack}
      rankingKey={rankingKey} stats={`${guesses.length}/${cfg.attempts} tentativas · ${cfg.length} posições · ${cfg.colors} cores`}>
      <p className="text-center text-slate-500 mb-4 text-sm">
        ● preto = cor e posição certas · ○ branco = cor certa, posição errada.
      </p>

      <div className="max-w-md mx-auto space-y-2 mb-6">
        {guesses.map((g, i) => (
          <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
            <div className="flex gap-2">
              {g.colors.map((c, k) => <span key={k} className="w-8 h-8 rounded-full" style={{ background: PALETTE[c] }} />)}
            </div>
            <span className="font-black tracking-widest text-slate-700" aria-label={`${g.exact} certas, ${g.partial} na posição errada`}>
              {'●'.repeat(g.exact)}<span className="text-slate-400">{'○'.repeat(g.partial)}</span>
            </span>
          </div>
        ))}
      </div>

      {over ? (
        <div className="flex justify-center gap-2 mb-4">
          {code.map((c, k) => <span key={k} className="w-9 h-9 rounded-full ring-2 ring-slate-800" style={{ background: PALETTE[c] }} />)}
        </div>
      ) : (
        <>
          <div className="flex justify-center gap-2 mb-4">
            {current.map((c, k) => (
              <button
                key={k}
                aria-label={`Posição ${k + 1}`}
                onClick={() => setCurrent(current.map((v, i) => (i === k ? null : v)))}
                className="w-11 h-11 rounded-full border-2 border-dashed border-slate-300"
                style={{ background: c === null ? 'transparent' : PALETTE[c] }}
              />
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {PALETTE.slice(0, cfg.colors).map((color, i) => (
              <button key={i} aria-label={`Cor ${i + 1}`} onClick={() => pick(i)}
                className="w-11 h-11 rounded-full shadow active:scale-90" style={{ background: color }} />
            ))}
          </div>
          <div className="text-center">
            <button onClick={submit} disabled={current.includes(null)}
              className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black disabled:opacity-40">
              Testar combinação
            </button>
          </div>
        </>
      )}

      {points !== null && (
        <WinPanel
          title="Código decifrado!"
          text={`Em ${guesses.length} tentativa(s).`}
          points={points}
          saveError={saveError}
          canAdvance={level < unlocked}
          onNext={() => setLevel(level + 1)}
          onRetry={() => setAttempt((a) => a + 1)}
        />
      )}
      {lost && (
        <div className="mt-6 p-6 bg-red-50 rounded-2xl border border-red-200 text-center">
          <h3 className="text-xl font-black text-red-700 mb-2">Não foi desta vez</h3>
          <p className="text-red-600 mb-3">Esse era o código. Tente um novo.</p>
          <button onClick={() => setAttempt((a) => a + 1)} className="bg-red-600 text-white px-8 py-2 rounded-full font-bold">
            Tentar outro código
          </button>
        </div>
      )}
    </GameShell>
  );
};

export default MastermindGame;
